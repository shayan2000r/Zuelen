-- IGSS, Paramètres sociaux au 1er janvier 2026 (indice 968,04): abattement assurance dépendance
-- (25 % du SSM non qualifié de 18 ans) = 675,93 EUR. Production had 675,94.
update public.ccss_parameter_periods
set dependency_allowance = 675.93,
    source_reference = 'https://igss.gouvernement.lu/dam-assets/publications/param%C3%A8tres-sociaux/2026/par-soc-202601.pdf',
    verified_at = '2026-10-09T00:00:00Z'
where effective_from = '2026-01-01' and dependency_allowance = 675.94;
