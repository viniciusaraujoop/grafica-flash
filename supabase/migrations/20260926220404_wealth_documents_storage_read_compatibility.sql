-- Hosted Storage authenticated retrieval uses legacy info operation names. Signing remains denied.
begin;
alter policy wealth_documents_download on storage.objects to authenticated using(
 bucket_id='wealth-documents' and storage.allow_any_operation(array['object.get_authenticated','object.get_authenticated_info','object.head_authenticated_info','object.delete','object.delete_many'])
 and exists(select 1 from public.wealth_documents d where d.object_path=name and d.user_id=(select auth.uid()) and (
  (d.status='active' and storage.allow_any_operation(array['object.get_authenticated','object.get_authenticated_info','object.head_authenticated_info'])) or
  (d.status='deleting' and storage.allow_any_operation(array['object.delete','object.delete_many']) and (select ecosystem_private.has_personal_access('wealth','wealth.write')))
 ))
);
commit;
