"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { OrganizationRole } from "@/lib/permissions";
import { canAccount, canBookkeep, canManageOrganization } from "@/lib/permissions";

type RoleContextValue={role:OrganizationRole|null;canBookkeep:boolean;canAccount:boolean;canManage:boolean;readOnly:boolean};
const RoleContext=createContext<RoleContextValue>({role:null,canBookkeep:false,canAccount:false,canManage:false,readOnly:true});

export function RoleProvider({role,children}:{role:OrganizationRole|null;children:ReactNode}){
 return <RoleContext.Provider value={{role,canBookkeep:canBookkeep(role),canAccount:canAccount(role),canManage:canManageOrganization(role),readOnly:role==="viewer"}}>{children}</RoleContext.Provider>;
}
export function useRolePermissions(){return useContext(RoleContext)}
