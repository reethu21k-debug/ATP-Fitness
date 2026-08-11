insert into public.permissions (role, resource, action, allowed) values
  ('gym_owner','attendance','create',true),
  ('gym_owner','attendance','read',true),
  ('trainer','attendance','read',true)
on conflict (role, resource, action) do nothing;
