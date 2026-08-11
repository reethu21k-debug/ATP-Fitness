-- ============================================================================
-- Extend the default permission matrix for the Payments module.
-- gym_owner implicitly has full access via other checks in some policies,
-- but has_permission() looks up explicit rows — add them so recordPayment/
-- issueRefund don't silently fail for gym owners.
-- ============================================================================

insert into public.permissions (role, resource, action, allowed) values
  ('gym_owner','payments','create',true),
  ('gym_owner','payments','read',true),
  ('gym_owner','refunds','create',true),
  ('receptionist','refunds','create',false)
on conflict (role, resource, action) do nothing;
