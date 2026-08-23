# Accountant directory V1

QA before Stripe activation:

- Business users can browse `/app/accountants` on both Zuelen Basic and Premium.
- Professional onboarding is available at `/accountants/manage` without requiring a company workspace.
- New and materially edited profiles remain pending until manually approved.
- Directory visibility requires approval plus an active or trialing listing subscription.
- Accountant Basic is €19/month; Accountant Premium is €29/month; both use a 30-day trial with a payment method collected up front.
- Premium profiles receive priority placement and a Featured badge; analytics are Premium-only.
- Stripe checkout remains disabled until `STRIPE_ACCOUNTANT_BASIC_MONTHLY_PRICE_ID` and `STRIPE_ACCOUNTANT_PREMIUM_MONTHLY_PRICE_ID` are configured.
