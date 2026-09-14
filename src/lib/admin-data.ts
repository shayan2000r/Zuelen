import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { ZUELEN_ADMIN_EMAIL } from "@/lib/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export type AdminUserRow = {
  id: string;
  email: string;
  fullName: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  types: string[];
  organizations: string[];
  plan: string;
  subscriptionStatus: string;
};

async function listAuthUsers(admin: AdminClient) {
  const users = [];
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return users;
}

export async function getAdminData(admin: AdminClient) {
  const [
    authUsers,
    companiesResult,
    organizationsResult,
    membershipsResult,
    profilesResult,
    subscriptionsResult,
    accountantProfilesResult,
    accountantSubscriptionsResult,
    waitlistResult,
  ] = await Promise.all([
    listAuthUsers(admin),
    admin.from("companies").select("id,organization_id,legal_name,trading_name,entity_kind,created_at"),
    admin.from("organizations").select("id,name,owner_id,created_at"),
    admin.from("organization_members").select("organization_id,user_id,role,created_at"),
    admin.from("user_profiles").select("user_id,full_name,locale"),
    admin.from("organization_subscriptions").select("organization_id,plan,status,billing_source,billing_interval,current_period_end,cancel_at_period_end"),
    admin.from("accountant_profiles").select("id,user_id,full_name,firm_name,approval_status,created_at,updated_at"),
    admin.from("accountant_listing_subscriptions").select("profile_id,tier,status,trial_end,current_period_end,cancel_at_period_end,stripe_subscription_id"),
    admin.from("early_access_waitlist").select("id,email,audience,locale,status,created_at,approved_at,invited_at,activated_at").order("created_at", { ascending: false }),
  ]);

  const queryResults = [
    companiesResult, organizationsResult, membershipsResult, profilesResult,
    subscriptionsResult, accountantProfilesResult, accountantSubscriptionsResult, waitlistResult,
  ];
  const failed = queryResults.find(result => result.error);
  if (failed?.error) throw new Error(failed.error.message);

  const companies = companiesResult.data ?? [];
  const organizations = organizationsResult.data ?? [];
  const memberships = membershipsResult.data ?? [];
  const profiles = profilesResult.data ?? [];
  const subscriptions = subscriptionsResult.data ?? [];
  const accountantProfiles = accountantProfilesResult.data ?? [];
  const accountantSubscriptions = accountantSubscriptionsResult.data ?? [];
  const waitlist = waitlistResult.data ?? [];

  const organizationById = new Map(organizations.map(item => [item.id, item]));
  const companyByOrganization = new Map(companies.map(item => [item.organization_id, item]));
  const profileByUser = new Map(profiles.map(item => [item.user_id, item]));
  const subscriptionByOrganization = new Map(subscriptions.map(item => [item.organization_id, item]));
  const accountantByUser = new Map(accountantProfiles.map(item => [item.user_id, item]));
  const membershipsByUser = new Map<string, typeof memberships>();

  for (const membership of memberships) {
    const current = membershipsByUser.get(membership.user_id) ?? [];
    current.push(membership);
    membershipsByUser.set(membership.user_id, current);
  }

  const users: AdminUserRow[] = authUsers
    .filter(user => user.email?.toLowerCase() !== ZUELEN_ADMIN_EMAIL)
    .map(user => {
      const userMemberships = membershipsByUser.get(user.id) ?? [];
      const organizationNames = userMemberships
        .map(item => organizationById.get(item.organization_id)?.name)
        .filter((value): value is string => Boolean(value));

      const types = new Set<string>();
      for (const membership of userMemberships) {
        const company = companyByOrganization.get(membership.organization_id);
        if (company?.entity_kind === "independent") types.add("Independent");
        if (company?.entity_kind === "company") types.add("Company");
      }
      if (accountantByUser.has(user.id)) types.add("Accountant");
      if (!types.size && userMemberships.length) types.add("Team member");

      const firstSubscription = userMemberships
        .map(item => subscriptionByOrganization.get(item.organization_id))
        .find(Boolean);

      return {
        id: user.id,
        email: user.email ?? "—",
        fullName: profileByUser.get(user.id)?.full_name ?? null,
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at ?? null,
        types: [...types],
        organizations: organizationNames,
        plan: firstSubscription?.plan ?? "—",
        subscriptionStatus: firstSubscription?.status ?? "—",
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const pendingAccountants = accountantProfiles.filter(item => item.approval_status === "pending");
  const activeSubscriptions =
    subscriptions.filter(item => item.status === "active").length +
    accountantSubscriptions.filter(item => item.status === "active").length;
  const trialSubscriptions =
    subscriptions.filter(item => item.status === "trialing").length +
    accountantSubscriptions.filter(item => item.status === "trialing").length;
  const cancellationsScheduled =
    subscriptions.filter(item => item.cancel_at_period_end).length +
    accountantSubscriptions.filter(item => item.cancel_at_period_end).length;

  return {
    stats: {
      users: users.length,
      independents: companies.filter(item => item.entity_kind === "independent").length,
      companies: companies.filter(item => item.entity_kind === "company").length,
      accountants: accountantProfiles.length,
      approvedAccountants: accountantProfiles.filter(item => item.approval_status === "approved").length,
      pendingAccountants: pendingAccountants.length,
      activeSubscriptions,
      trialSubscriptions,
      cancellationsScheduled,
      waitlistTotal: waitlist.length,
      waitlistWaiting: waitlist.filter(item => item.status === "waiting").length,
      waitlistInvited: waitlist.filter(item => item.status === "invited").length,
      waitlistActivated: waitlist.filter(item => item.status === "activated").length,
      waitlistRejected: waitlist.filter(item => item.status === "rejected").length,
    },
    users,
    recentUsers: users.slice(0, 6),
    recentWaitlist: waitlist.slice(0, 6),
    waitlist,
    pendingAccountants: pendingAccountants.slice(0, 6),
  };
}
