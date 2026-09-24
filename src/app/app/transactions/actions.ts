"use server";

import { revalidatePath } from "next/cache";
import { assertUsageAvailable, billingLimitMessage } from "@/lib/billing";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import { userFacingDataError } from "@/lib/user-facing-error";
import { canBookkeep } from "@/lib/permissions";

export type TransactionReview={id:string;occurredOn:string;direction:string;amountGross:number;currency:string;baseCurrency:string;exchangeRateToBase:number|null;counterpartyName:string;classificationStatus:string;suggestedCode:string|null;suggestedLabel:string|null;suggestionConfidence:number|null;suggestionReason:string|null;accounts:{code:string;label:string;accountType:string}[]};
export type TransactionActionState={status:"idle"|"success"|"error";message:string;journalEntryId?:string;transactionId?:string;documentId?:string;matchedExisting?:boolean;review?:TransactionReview};
const treatments=["domestic","eu_b2b_reverse_charge","non_eu","exempt_or_zero","unknown"];
function roundMoney(value:number){return Math.round((value+Number.EPSILON)*100)/100}
function validUuid(value:string){return /^[0-9a-f-]{36}$/i.test(value)}
function safeEvidenceFileName(name:string){const parts=name.split("."),ext=parts.length>1?`.${parts.pop()?.toLowerCase().replace(/[^a-z0-9]/g,"")}`:"",base=parts.join(".").normalize("NFKD").replace(/[^a-zA-Z0-9-_]+/g,"-").replace(/^-+|-+$/g,"").slice(0,80)||"evidence";return`${base}${ext}`}
function refreshBooks(){for(const path of ["/app","/app/transactions","/app/documents","/app/accounting","/app/taxes","/app/vat","/app/banking","/app/year-end","/app/settings/usage"])revalidatePath(path)}
function calculateVat(formData:FormData){
 const entered=Number(formData.get("amount")??formData.get("amount_gross")),rate=Number(formData.get("vat_rate")||0),included=String(formData.get("vat_included")??"yes")!=="no",treatment=String(formData.get("vat_treatment")??"domestic");
 if(!Number.isFinite(entered)||entered<=0)return{error:"Amount must be greater than zero."} as const;
 if(![0,3,8,14,17].includes(rate))return{error:"Choose a supported Luxembourg VAT rate."} as const;
 if(!treatments.includes(treatment))return{error:"Choose a valid VAT treatment."} as const;
 if(treatment==="eu_b2b_reverse_charge"){const net=roundMoney(entered),vat=roundMoney(net*rate/100);return{gross:net,net,vat,rate,included:false,treatment} as const}
 if(treatment==="non_eu"||treatment==="exempt_or_zero"||rate===0)return{gross:roundMoney(entered),net:roundMoney(entered),vat:0,rate:0,included,treatment} as const;
 if(included){const gross=roundMoney(entered),net=roundMoney(gross/(1+rate/100));return{gross,net,vat:roundMoney(gross-net),rate,included,treatment} as const}
 const net=roundMoney(entered),vat=roundMoney(net*rate/100);return{gross:roundMoney(net+vat),net,vat,rate,included,treatment} as const;
}

export async function createSourceTransaction(_previous:TransactionActionState,formData:FormData):Promise<TransactionActionState>{
 const workspace=await getWorkspace();if(!workspace.authenticated||!workspace.userId||!workspace.organization||!workspace.company)return{status:"error",message:"Your session expired. Please sign in again."};
 const occurredOn=String(formData.get("occurred_on")??""),direction=String(formData.get("direction")??""),counterparty=String(formData.get("counterparty_name")??"").trim(),description=String(formData.get("description")??"").trim(),country=String(formData.get("counterparty_country")??"").trim().toUpperCase(),selectedAccountCode=String(formData.get("account_code")??"").trim(),transactionCurrency=String(formData.get("currency")??workspace.company.base_currency??"EUR").trim().toUpperCase(),baseCurrency=String(workspace.company.base_currency||"EUR").trim().toUpperCase(),enteredFx=Number(formData.get("exchange_rate_to_base")??0),vat=calculateVat(formData),locale=workspace.profile?.locale==="fr"?"fr":"en";
 if(!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn))return{status:"error",message:locale==="fr"?"Choisissez une date valide.":"Choose a valid transaction date."};
 if(!["income","expense"].includes(direction))return{status:"error",message:locale==="fr"?"Choisissez Dépense ou Revenu.":"Choose income or expense."};
 if(!counterparty&&!description)return{status:"error",message:locale==="fr"?"Indiquez avec qui l’opération a eu lieu ou à quoi elle correspond.":"Tell Zuelen who this was with or what the transaction was for."};
 if(!/^[A-Z]{3}$/.test(transactionCurrency))return{status:"error",message:locale==="fr"?"Saisissez un code devise ISO à 3 lettres, par exemple EUR ou USD.":"Enter a 3-letter ISO currency code such as EUR or USD."};
 const exchangeRateToBase=transactionCurrency===baseCurrency?1:(Number.isFinite(enteredFx)&&enteredFx>0?enteredFx:null);
 if(transactionCurrency!==baseCurrency&&!exchangeRateToBase)return{status:"error",message:locale==="fr"?`Indiquez le taux de change : 1 ${transactionCurrency} = ? ${baseCurrency}.`:`Enter the exchange rate: 1 ${transactionCurrency} = ? ${baseCurrency}.`};
 if("error" in vat)return{status:"error",message:vat.error??"VAT calculation failed."};
 if(!workspace.company.vat_registered&&vat.vat>0)return{status:"error",message:locale==="fr"?"Cette entreprise n’est pas configurée comme assujettie à la TVA. Laissez les détails TVA sur « Je ne sais pas » ou mettez à jour le profil TVA.":"This company is not marked as VAT registered. Leave VAT details as “Not sure” or update the VAT profile."};
 try{await assertUsageAvailable(workspace.organization.id,"transactions",1)}catch(error){return{status:"error",message:billingLimitMessage(error,locale)??userFacingDataError(error,"Your Basic transaction allowance has been reached.",locale)}}
 const supabase=await createClient();
 let selectedAccount:{id:string;code:string;account_type:string}|null=null;
 if(selectedAccountCode){
   const allowedTypes=direction==="income"?["revenue","asset","liability","expense"]:["expense","asset","liability"];
   const{data:selected,error:selectedError}=await supabase.from("company_accounts").select("id,code,account_type").eq("company_id",workspace.company.id).eq("code",selectedAccountCode).eq("is_active",true).maybeSingle();
   if(selectedError)return{status:"error",message:userFacingDataError(selectedError,locale==="fr"?"La catégorie comptable n’a pas pu être vérifiée.":"The accounting category could not be verified.",locale)};
   if(!selected||!allowedTypes.includes(selected.account_type))return{status:"error",message:locale==="fr"?"Cette catégorie n’est pas disponible pour ce type de transaction.":"That accounting category is not available for this transaction type."};
   selectedAccount=selected;
 }
 const{data,error}=await supabase.from("source_transactions").insert({
   organization_id:workspace.organization.id,
   company_id:workspace.company.id,
   occurred_on:occurredOn,
   direction,
   amount_gross:vat.gross,
   amount_net:vat.net,
   vat_amount:vat.vat,
   vat_rate:vat.rate,
   vat_treatment:vat.treatment,
   counterparty_country:country||null,
   currency:transactionCurrency,
   exchange_rate_to_base:exchangeRateToBase,
   counterparty_name:counterparty||null,
   description:description||null,
   source_type:"manual",
   classification_status:"review",
   suggested_account_id:selectedAccount?.id??null,
   suggestion_confidence:selectedAccount?1:null,
   suggestion_reason:selectedAccount?(locale==="fr"?"Catégorie choisie lors de la saisie manuelle.":"Category selected during manual entry."):null,
   suggestion_kind:selectedAccount?"manual_selected":null,
   created_by:workspace.userId
 }).select("id").single();
 if(error){const friendly=billingLimitMessage(new Error(error.message),locale);return{status:"error",message:friendly??userFacingDataError(error,undefined,locale)}}
 if(!data?.id)return{status:"error",message:locale==="fr"?"Zuelen n’a pas pu préparer cette transaction. Réessayez.":"Zuelen couldn't prepare this transaction. Please try again."};

 if(!selectedAccount)await supabase.rpc("apply_source_transaction_suggestion",{p_source_transaction_id:data.id});
 const{data:transaction,error:transactionError}=await supabase.from("source_transactions")
   .select("id,occurred_on,direction,amount_gross,currency,exchange_rate_to_base,counterparty_name,classification_status,suggested_account_id,suggestion_confidence,suggestion_reason")
   .eq("id",data.id).eq("company_id",workspace.company.id).maybeSingle();
 if(transactionError||!transaction)return{status:"error",message:transactionError?userFacingDataError(transactionError,"The prepared transaction could not be loaded.",locale):"The prepared transaction could not be loaded."};

 const allowedTypes=transaction.direction==="income"?["revenue","asset","liability","expense"]:["expense","asset","liability"];
 const{data:accountRows,error:accountError}=await supabase.from("company_accounts")
   .select("id,code,label,label_en,label_fr,account_type")
   .eq("company_id",workspace.company.id).eq("is_active",true).in("account_type",allowedTypes).order("code",{ascending:true});
 if(accountError)return{status:"error",message:userFacingDataError(accountError,"The accounting categories could not be loaded.",locale)};

 const fr=locale==="fr",accounts=(accountRows??[]).map(account=>({
   code:account.code,
   label:(fr?(account.label_fr||account.label_en||account.label):(account.label_en||account.label_fr||account.label))??account.code,
   accountType:account.account_type
 }));
 const suggested=(accountRows??[]).find(account=>account.id===transaction.suggested_account_id);
 const review:TransactionReview={
   id:transaction.id,
   occurredOn:transaction.occurred_on,
   direction:transaction.direction,
   amountGross:Number(transaction.amount_gross),
   currency:transaction.currency,
   baseCurrency,
   exchangeRateToBase:transaction.exchange_rate_to_base==null?null:Number(transaction.exchange_rate_to_base),
   counterpartyName:transaction.counterparty_name||description||(fr?"Transaction":"Transaction"),
   classificationStatus:transaction.classification_status,
   suggestedCode:suggested?.code??null,
   suggestedLabel:suggested?((fr?(suggested.label_fr||suggested.label_en||suggested.label):(suggested.label_en||suggested.label_fr||suggested.label))??suggested.code):null,
   suggestionConfidence:transaction.suggestion_confidence==null?null:Number(transaction.suggestion_confidence),
   suggestionReason:transaction.suggestion_reason??null,
   accounts
 };
 refreshBooks();
 return{
   status:"success",
   message:selectedAccount
     ?(fr?"Catégorie sélectionnée. Vérifiez-la une dernière fois avant d’ajouter la transaction.":"Category selected. Give it one final check before adding the transaction.")
     :vat.treatment==="unknown"
       ?(fr?"Détails prêts. Zuelen n’a pas deviné la TVA : confirmez maintenant la catégorie comptable.":"Details ready. Zuelen did not guess VAT — now confirm the accounting category.")
       :(fr?"Détails prêts. Vérifiez la catégorie comptable avant d’ajouter la transaction.":"Details ready. Confirm the accounting category before adding the transaction."),
   transactionId:data.id,
   review
 };
}

export async function discardManualSourceTransactionAction(transactionId:string):Promise<TransactionActionState>{
 const workspace=await getWorkspace();if(!workspace.authenticated||!workspace.company)return{status:"error",message:"Your session expired. Please sign in again."};
 if(!validUuid(transactionId))return{status:"error",message:"The transaction reference is invalid."};
 const supabase=await createClient();
 const{data:row,error:loadError}=await supabase.from("source_transactions").select("id,source_type,classification_status").eq("id",transactionId).eq("company_id",workspace.company.id).maybeSingle();
 if(loadError)return{status:"error",message:userFacingDataError(loadError)};
 if(!row)return{status:"success",message:"Draft already cleared."};
 if(row.source_type!=="manual"||row.classification_status==="posted")return{status:"error",message:"This transaction can no longer be cancelled from the entry flow."};
 const{error}=await supabase.from("source_transactions").delete().eq("id",transactionId).eq("company_id",workspace.company.id);
 if(error)return{status:"error",message:userFacingDataError(error)};
 refreshBooks();
 return{status:"success",message:"Manual draft cancelled."};
}

export async function attachEvidenceToTransactionAction(_previous:TransactionActionState,formData:FormData):Promise<TransactionActionState>{
 const workspace=await getWorkspace();
 const locale=workspace.profile?.locale==="fr"?"fr":"en";
 if(!workspace.authenticated||!workspace.userId||!workspace.organization||!workspace.company)return{status:"error",message:locale==="fr"?"Votre session a expiré. Reconnectez-vous.":"Your session expired. Please sign in again."};
 if(!canBookkeep(workspace.role))return{status:"error",message:locale==="fr"?"Votre rôle ne permet pas d’ajouter des justificatifs.":"Your role cannot attach evidence."};
 const transactionId=String(formData.get("source_transaction_id")??"").trim();
 if(!validUuid(transactionId))return{status:"error",message:locale==="fr"?"La référence de transaction est invalide.":"The transaction reference is invalid."};
 const file=formData.get("evidence_file");
 if(!(file instanceof File)||file.size<=0)return{status:"error",message:locale==="fr"?"Choisissez un justificatif à joindre.":"Choose a document to attach."};
 const allowed=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
 if(!allowed.has(file.type))return{status:"error",message:locale==="fr"?"Utilisez un fichier PDF, JPG, PNG ou WebP.":"Use a PDF, JPG, PNG or WebP file."};
 if(file.size>25*1024*1024)return{status:"error",message:locale==="fr"?"Le fichier doit faire 25 Mo maximum.":"The maximum file size is 25 MB."};
 const requestedType=String(formData.get("document_type")??"receipt");
 const documentType=["receipt","purchase_invoice","sales_invoice","other"].includes(requestedType)?requestedType:"receipt";
 try{await assertUsageAvailable(workspace.organization.id,"documents",1)}catch(error){return{status:"error",message:billingLimitMessage(error,locale)??userFacingDataError(error,locale==="fr"?"La limite de documents a été atteinte.":"Your document allowance has been reached.",locale)}}
 const supabase=await createClient();
 const{data:transaction,error:transactionError}=await supabase.from("source_transactions").select("id,occurred_on").eq("id",transactionId).eq("company_id",workspace.company.id).maybeSingle();
 if(transactionError)return{status:"error",message:userFacingDataError(transactionError,undefined,locale)};
 if(!transaction)return{status:"error",message:locale==="fr"?"Transaction introuvable.":"Transaction not found."};
 const uploadYear=Number(String(transaction.occurred_on).slice(0,4))||new Date().getFullYear();
 const storagePath=`${workspace.organization.id}/${workspace.company.id}/${uploadYear}/${crypto.randomUUID()}-${safeEvidenceFileName(file.name)}`;
 const{error:storageError}=await supabase.storage.from("company-documents").upload(storagePath,file,{contentType:file.type,upsert:false,cacheControl:"3600"});
 if(storageError)return{status:"error",message:userFacingDataError(storageError,locale==="fr"?"Le justificatif n’a pas pu être importé. Réessayez.":"The evidence could not be uploaded. Please try again.",locale)};
 const{data:document,error:documentError}=await supabase.from("documents").insert({
   organization_id:workspace.organization.id,
   company_id:workspace.company.id,
   type:documentType,
   storage_path:storagePath,
   file_name:file.name,
   mime_type:file.type,
   file_size:file.size,
   extraction_status:"not_started",
   created_by:workspace.userId
 }).select("id").single();
 if(documentError||!document){
   await supabase.storage.from("company-documents").remove([storagePath]);
   return{status:"error",message:userFacingDataError(documentError,locale==="fr"?"Le justificatif n’a pas pu être enregistré.":"The evidence could not be saved.",locale)};
 }
 const{data:link,error:linkError}=await supabase.from("document_transaction_links").insert({
   organization_id:workspace.organization.id,
   company_id:workspace.company.id,
   document_id:document.id,
   source_transaction_id:transactionId,
   match_score:1,
   status:"suggested",
   match_reason:"Evidence attached directly from the transaction.",
   created_by:workspace.userId
 }).select("id").single();
 if(linkError||!link){
   await supabase.from("documents").delete().eq("id",document.id).eq("company_id",workspace.company.id);
   await supabase.storage.from("company-documents").remove([storagePath]);
   return{status:"error",message:userFacingDataError(linkError,locale==="fr"?"Le justificatif n’a pas pu être lié à la transaction.":"The evidence could not be linked to the transaction.",locale)};
 }
 const{error:confirmError}=await supabase.rpc("confirm_document_match",{p_link_id:link.id});
 if(confirmError){
   await supabase.from("document_transaction_links").delete().eq("id",link.id);
   await supabase.from("documents").delete().eq("id",document.id).eq("company_id",workspace.company.id);
   await supabase.storage.from("company-documents").remove([storagePath]);
   return{status:"error",message:userFacingDataError(confirmError,locale==="fr"?"Le justificatif n’a pas pu être lié à la transaction.":"The evidence could not be linked to the transaction.",locale)};
 }
 refreshBooks();
 return{status:"success",message:locale==="fr"?"Justificatif ajouté et lié à cette transaction.":"Evidence attached and linked to this transaction.",transactionId,documentId:document.id};
}

export async function createTransactionFromDocumentAction(documentId:string):Promise<TransactionActionState>{
 const workspace=await getWorkspace();if(!workspace.authenticated||!workspace.company)return{status:"error",message:"Your session expired. Please sign in again."};if(!validUuid(documentId))return{status:"error",message:"The document reference is invalid."};
 const supabase=await createClient();const{data,error}=await supabase.rpc("create_source_transaction_from_document",{p_document_id:documentId});
 if(error){const friendly=billingLimitMessage(new Error(error.message),workspace.profile?.locale==="fr"?"fr":"en");return{status:"error",message:friendly??userFacingDataError(error)}}
 const result=data&&typeof data==="object"?data as Record<string,unknown>:{},transactionId=typeof result.transaction_id==="string"?result.transaction_id:undefined,matchedExisting=result.matched_existing===true,alreadyCreated=result.already_created===true;
 if(!transactionId)return{status:"error",message:"Zuelen analyzed the document but could not prepare the transaction."};

 const{data:transaction,error:transactionError}=await supabase.from("source_transactions").select("id,occurred_on,direction,amount_gross,currency,exchange_rate_to_base,counterparty_name,classification_status,suggested_account_id,suggestion_confidence,suggestion_reason").eq("id",transactionId).eq("company_id",workspace.company.id).maybeSingle();
 if(transactionError||!transaction)return{status:"error",message:transactionError?userFacingDataError(transactionError,"The prepared transaction could not be loaded."):"The prepared transaction could not be loaded."};
 const allowedTypes=transaction.direction==="income"?["revenue","asset","liability","expense"]:["expense","asset","liability"];
 const{data:accountRows,error:accountError}=await supabase.from("company_accounts").select("id,code,label,label_en,label_fr,account_type").eq("company_id",workspace.company.id).eq("is_active",true).in("account_type",allowedTypes).order("code",{ascending:true});
 if(accountError)return{status:"error",message:userFacingDataError(accountError,"The accounting categories could not be loaded.")};
 const fr=workspace.profile?.locale==="fr",accounts=(accountRows??[]).map(account=>({code:account.code,label:(fr?(account.label_fr||account.label_en||account.label):(account.label_en||account.label_fr||account.label))??account.code,accountType:account.account_type}));
 const suggested=(accountRows??[]).find(account=>account.id===transaction.suggested_account_id);
 const review:TransactionReview={id:transaction.id,occurredOn:transaction.occurred_on,direction:transaction.direction,amountGross:Number(transaction.amount_gross),currency:transaction.currency,baseCurrency:String(workspace.company.base_currency||"EUR").trim().toUpperCase(),exchangeRateToBase:transaction.exchange_rate_to_base==null?null:Number(transaction.exchange_rate_to_base),counterpartyName:transaction.counterparty_name||"Transaction",classificationStatus:transaction.classification_status,suggestedCode:suggested?.code??null,suggestedLabel:suggested?((fr?(suggested.label_fr||suggested.label_en||suggested.label):(suggested.label_en||suggested.label_fr||suggested.label))??suggested.code):null,suggestionConfidence:transaction.suggestion_confidence==null?null:Number(transaction.suggestion_confidence),suggestionReason:transaction.suggestion_reason??null,accounts};
 refreshBooks();
 if(transaction.classification_status==="posted")return{status:"success",message:"This document is already linked to a posted transaction.",transactionId,matchedExisting,review};
 if(matchedExisting)return{status:"success",message:"Zuelen found the matching transaction and linked the evidence. Confirm or adjust the accounting category below.",transactionId,matchedExisting:true,review};
 if(alreadyCreated)return{status:"success",message:"This document already has a prepared transaction. Confirm or adjust the accounting category below.",transactionId,review};
 return{status:"success",message:"Zuelen prepared the transaction from your document. Confirm the suggested category or choose another one.",transactionId,review};
}

export async function postSourceTransaction(_previous:TransactionActionState,formData:FormData):Promise<TransactionActionState>{const workspace=await getWorkspace();if(!workspace.authenticated||!workspace.company)return{status:"error",message:"Your session expired. Please sign in again."};const locale=workspace.profile?.locale==="fr"?"fr":"en",id=String(formData.get("source_transaction_id")??"").trim(),code=String(formData.get("account_code")??"").trim(),submittedFx=Number(formData.get("exchange_rate_to_base")??0);if(!validUuid(id))return{status:"error",message:"The transaction reference is invalid."};if(!/^\d{3,6}$/.test(code))return{status:"error",message:"Choose a valid accounting category."};const supabase=await createClient();const{data:tx,error:txError}=await supabase.from("source_transactions").select("currency,exchange_rate_to_base").eq("id",id).eq("company_id",workspace.company.id).maybeSingle();if(txError||!tx)return{status:"error",message:txError?userFacingDataError(txError,locale==="fr"?"La transaction n’a pas pu être chargée.":"The transaction could not be loaded.",locale):"Transaction not found."};const baseCurrency=String(workspace.company.base_currency||"EUR").trim().toUpperCase(),txCurrency=String(tx.currency||baseCurrency).trim().toUpperCase();if(txCurrency!==baseCurrency){const fx=Number.isFinite(submittedFx)&&submittedFx>0?submittedFx:Number(tx.exchange_rate_to_base??0);if(!Number.isFinite(fx)||fx<=0)return{status:"error",message:locale==="fr"?`Indiquez le taux de change : 1 ${txCurrency} = ? ${baseCurrency}.`:`Enter the exchange rate: 1 ${txCurrency} = ? ${baseCurrency}.`};const{error:updateFxError}=await supabase.from("source_transactions").update({exchange_rate_to_base:fx}).eq("id",id).eq("company_id",workspace.company.id);if(updateFxError)return{status:"error",message:userFacingDataError(updateFxError,locale==="fr"?"Le taux de change n’a pas pu être enregistré.":"The exchange rate could not be saved.",locale)}}const{data,error}=await supabase.rpc("classify_and_post_source_transaction",{p_source_transaction_id:id,p_account_code:code});if(error)return{status:"error",message:userFacingDataError(error,undefined,locale)};refreshBooks();return{status:"success",message:locale==="fr"?"Comptabilisée avec succès. L’écriture est verrouillée et auditable.":"Posted successfully. The journal entry is locked and auditable.",journalEntryId:typeof data==="string"?data:undefined}}
export async function bulkPostSuggestedTransactions(_previous:TransactionActionState):Promise<TransactionActionState>{const workspace=await getWorkspace();if(!workspace.authenticated||!workspace.company)return{status:"error",message:"Your session expired. Please sign in again."};const supabase=await createClient();const{data,error}=await supabase.rpc("bulk_post_suggested_source_transactions",{p_company_id:workspace.company.id});if(error)return{status:"error",message:userFacingDataError(error)};const result=data&&typeof data==="object"?data as Record<string,unknown>:{};const posted=Number(result.posted??0),remaining=Number(result.remaining??0);refreshBooks();return{status:"success",message:`${posted} suggested transaction${posted===1?"":"s"} posted · ${remaining} still need review.`}}
export async function bulkIgnorePendingTransactions(_previous:TransactionActionState):Promise<TransactionActionState>{const workspace=await getWorkspace();if(!workspace.authenticated||!workspace.company)return{status:"error",message:"Your session expired. Please sign in again."};const supabase=await createClient();const{data,error}=await supabase.rpc("bulk_ignore_pending_source_transactions",{p_company_id:workspace.company.id});if(error)return{status:"error",message:userFacingDataError(error)};refreshBooks();const count=Number(data??0);return{status:"success",message:`${count} remaining transaction${count===1?"":"s"} ignored. Bank evidence is retained.`}}
export async function recategorizeSourceTransactionAction(_previous:TransactionActionState,formData:FormData):Promise<TransactionActionState>{const workspace=await getWorkspace();if(!workspace.authenticated||!workspace.company)return{status:"error",message:"Your session expired. Please sign in again."};const id=String(formData.get("source_transaction_id")??""),code=String(formData.get("account_code")??"").trim();if(!validUuid(id)||!/^\d{3,6}$/.test(code))return{status:"error",message:"Choose a valid transaction and category."};const supabase=await createClient();const{error}=await supabase.rpc("recategorize_source_transaction_safe",{p_source_transaction_id:id,p_account_code:code});if(error)return{status:"error",message:userFacingDataError(error)};refreshBooks();return{status:"success",message:"Category corrected. The old posting was reversed and the replacement remains auditable."}}
export async function editSourceTransactionAction(_previous:TransactionActionState,formData:FormData):Promise<TransactionActionState>{const workspace=await getWorkspace();if(!workspace.authenticated||!workspace.company)return{status:"error",message:"Your session expired. Please sign in again."};const id=String(formData.get("source_transaction_id")??""),occurredOn=String(formData.get("occurred_on")??""),direction=String(formData.get("direction")??""),counterparty=String(formData.get("counterparty_name")??"").trim(),description=String(formData.get("description")??"").trim(),vat=calculateVat(formData);if(!validUuid(id))return{status:"error",message:"Invalid transaction."};if(!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)||!["income","expense"].includes(direction))return{status:"error",message:"Choose a valid date and type."};if("error" in vat)return{status:"error",message:vat.error??"VAT calculation failed."};if(!workspace.company.vat_registered&&vat.vat>0)return{status:"error",message:"This company is not marked as VAT registered."};const supabase=await createClient();const{data:current,error:loadError}=await supabase.from("source_transactions").select("classification_status").eq("id",id).eq("company_id",workspace.company.id).maybeSingle();if(loadError||!current)return{status:"error",message:loadError?userFacingDataError(loadError,"Transaction not found."):"Transaction not found."};const{error}=await supabase.rpc("update_source_transaction_safe",{p_source_transaction_id:id,p_occurred_on:occurredOn,p_direction:direction,p_amount_gross:vat.gross,p_vat_amount:vat.vat,p_counterparty_name:counterparty||null,p_description:description||null});if(error)return{status:"error",message:userFacingDataError(error)};if(current.classification_status!=="posted"){await supabase.from("source_transactions").update({amount_net:vat.net,vat_rate:vat.rate,vat_treatment:vat.treatment,counterparty_country:String(formData.get("counterparty_country")??"").trim().toUpperCase()||null}).eq("id",id);await supabase.rpc("apply_source_transaction_suggestion",{p_source_transaction_id:id});}refreshBooks();return{status:"success",message:"Transaction updated safely."}}
export async function deleteSourceTransactionAction(_previous:TransactionActionState,formData:FormData):Promise<TransactionActionState>{const workspace=await getWorkspace();if(!workspace.authenticated||!workspace.company)return{status:"error",message:"Your session expired. Please sign in again."};const id=String(formData.get("source_transaction_id")??"");if(!validUuid(id))return{status:"error",message:"Invalid transaction."};const supabase=await createClient();const{error}=await supabase.rpc("delete_source_transaction_safe",{p_source_transaction_id:id});if(error)return{status:"error",message:userFacingDataError(error)};refreshBooks();return{status:"success",message:"Transaction removed from active books; posted accounting is reversed rather than erased."}}

export async function bulkDeleteTransactionsAction(_previous:TransactionActionState,formData:FormData):Promise<TransactionActionState>{
 const workspace=await getWorkspace();if(!workspace.authenticated||!workspace.company)return{status:"error",message:"Your session expired. Please sign in again."};
 let ids:unknown;try{ids=JSON.parse(String(formData.get("ids")??"[]"))}catch{return{status:"error",message:"The selected transactions could not be read."}}
 if(!Array.isArray(ids)||ids.length===0||ids.length>200||ids.some(id=>typeof id!=="string"||!validUuid(id)))return{status:"error",message:"Choose between 1 and 200 valid transactions."};
 const supabase=await createClient();let removed=0;for(const id of ids){const{error}=await supabase.rpc("delete_source_transaction_safe",{p_source_transaction_id:id});if(error)return{status:"error",message:`${removed} removed before Zuelen stopped. ${userFacingDataError(error)}`};removed++}
 refreshBooks();return{status:"success",message:`${removed} transaction${removed===1?"":"s"} removed. Posted entries were reversed rather than erased.`};
}
