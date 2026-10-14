-- Optional product photo per component. Null by default; staff set it by editing
-- the row (any https image link). The client hides the picture when it is null.
alter table components
  add column if not exists image_url text;

alter table components
  drop constraint if exists components_image_url_http;
alter table components
  add constraint components_image_url_http
  check (image_url is null or image_url ~* '^https?://');

-- New columns can only be appended to an existing view, so image_url goes last.
create or replace view component_catalog
with (security_invoker = false)
as
select
  id,
  name,
  description,
  returnable,
  (count - reserved) as available,
  image_url
from components;

grant select on component_catalog to authenticated;
