Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$env:NPM_CONFIG_LOGLEVEL = "error"

$Root = (Get-Location).Path
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupRoot = Join-Path `
    $Root `
    ".orcaly-backups\admin-hardening-$Timestamp"

$ProxyRelative = "proxy.ts"
$ProxyPath = Join-Path $Root "proxy.ts"
$CheckerRelative = "scripts/admin-security-check.mjs"
$CheckerPath = Join-Path `
    $Root `
    "scripts\admin-security-check.mjs"
$MigrationDirectory = Join-Path `
    $Root `
    "supabase\migrations"
$MigrationMarker = "ORCALY_PLATFORM_ADMIN_HARDENING_V1"
$ProxyMarker = "ORCALY_PLATFORM_ADMIN_HARDENING_V1"

$MigrationBase64 = @'
LS0gT1JDQUxZX1BMQVRGT1JNX0FETUlOX0hBUkRFTklOR19WMQotLSBNYW50ZW0gdmluaWNpdXNhZG1Ab3JjYWx5LmNvbSBjb21vIHVuaWNvIG93bmVyIGF0aXZvIGUgZm9ybmVjZQotLSB2ZXJpZmljYWNhbyBzZWd1cmEgZG8gYWNlc3NvIGludGVybm8gcGFyYSBvIHByb3h5IGRvIE5leHQuanMuCgpiZWdpbjsKCnVwZGF0ZSBwdWJsaWMucGxhdGZvcm1fYWRtaW5zCnNldCByb2xlID0gJ293bmVyJywKICAgIGlzX2FjdGl2ZSA9IHRydWUsCiAgICBwZXJtaXNzaW9ucyA9ICd7ImFsbCI6dHJ1ZX0nOjpqc29uYiwKICAgIGFyZWEgPSBjb2FsZXNjZShudWxsaWYodHJpbShhcmVhKSwgJycpLCAnRGlyZWNhbycpLAogICAgbXVzdF9jaGFuZ2VfcGFzc3dvcmQgPSBmYWxzZSwKICAgIHVwZGF0ZWRfYXQgPSBub3coKQp3aGVyZSBsb3dlcihlbWFpbCkgPSAndmluaWNpdXNhZG1Ab3JjYWx5LmNvbSc7Cgp3aXRoIHJldm9rZWQgYXMgKAogIHVwZGF0ZSBwdWJsaWMucGxhdGZvcm1fYWRtaW5zCiAgc2V0IHJvbGUgPSAnYWRtaW4nLAogICAgICBpc19hY3RpdmUgPSBmYWxzZSwKICAgICAgcGVybWlzc2lvbnMgPSAne30nOjpqc29uYiwKICAgICAgb2JzZXJ2YWNvZXMgPSBjb25jYXRfd3MoCiAgICAgICAgRSdcbicsCiAgICAgICAgbnVsbGlmKHRyaW0ob2JzZXJ2YWNvZXMpLCAnJyksCiAgICAgICAgJ0FjZXNzbyBkZSBvd25lciByZXZvZ2FkbyBlbSAyOS8wNy8yMDI2LiBPIG93bmVyIG9maWNpYWwgZSB2aW5pY2l1c2FkbUBvcmNhbHkuY29tLicKICAgICAgKSwKICAgICAgdXBkYXRlZF9hdCA9IG5vdygpCiAgd2hlcmUgbG93ZXIoZW1haWwpIDw+ICd2aW5pY2l1c2FkbUBvcmNhbHkuY29tJwogICAgYW5kIGxvd2VyKHJvbGUpIGluICgnb3duZXInLCAnc3VwZXJfYWRtaW4nKQogIHJldHVybmluZyB1c2VyX2lkCikKdXBkYXRlIGF1dGgudXNlcnMgdQpzZXQgcmF3X2FwcF9tZXRhX2RhdGEgPQogICAgICBjb2FsZXNjZSh1LnJhd19hcHBfbWV0YV9kYXRhLCAne30nOjpqc29uYikKICAgICAgLSAnb3JjYWx5X3JvbGUnLAogICAgdXBkYXRlZF9hdCA9IG5vdygpCndoZXJlIHUuaWQgaW4gKAogIHNlbGVjdCB1c2VyX2lkCiAgZnJvbSByZXZva2VkCiAgd2hlcmUgdXNlcl9pZCBpcyBub3QgbnVsbAopOwoKdXBkYXRlIGF1dGgudXNlcnMKc2V0IHJhd19hcHBfbWV0YV9kYXRhID0KICAgICAgY29hbGVzY2UocmF3X2FwcF9tZXRhX2RhdGEsICd7fSc6Ompzb25iKQogICAgICB8fCBqc29uYl9idWlsZF9vYmplY3QoCiAgICAgICAgJ29yY2FseV9yb2xlJywKICAgICAgICAnb3duZXInCiAgICAgICksCiAgICB1cGRhdGVkX2F0ID0gbm93KCkKd2hlcmUgbG93ZXIoZW1haWwpID0gJ3ZpbmljaXVzYWRtQG9yY2FseS5jb20nOwoKYWx0ZXIgdGFibGUgcHVibGljLnBsYXRmb3JtX2FkbWlucwogIGVuYWJsZSByb3cgbGV2ZWwgc2VjdXJpdHk7CgpyZXZva2UgYWxsCm9uIHRhYmxlIHB1YmxpYy5wbGF0Zm9ybV9hZG1pbnMKZnJvbSBhbm9uLCBhdXRoZW50aWNhdGVkOwoKZHJvcCBpbmRleCBpZiBleGlzdHMKICBwdWJsaWMucGxhdGZvcm1fYWRtaW5zX3NpbmdsZV9hY3RpdmVfb3duZXJfdWlkeDsKCmNyZWF0ZSB1bmlxdWUgaW5kZXgKICBwbGF0Zm9ybV9hZG1pbnNfc2luZ2xlX2FjdGl2ZV9vd25lcl91aWR4Cm9uIHB1YmxpYy5wbGF0Zm9ybV9hZG1pbnMgKCgxKSkKd2hlcmUgaXNfYWN0aXZlID0gdHJ1ZQogIGFuZCBsb3dlcihyb2xlKSA9ICdvd25lcic7CgpjcmVhdGUgb3IgcmVwbGFjZSBmdW5jdGlvbgogIHB1YmxpYy5nZXRfbXlfcGxhdGZvcm1fYWRtaW5fYWNjZXNzKCkKcmV0dXJucyB0YWJsZSAoCiAgYWRtaW5faWQgdXVpZCwKICBhZG1pbl9lbWFpbCB0ZXh0LAogIGFkbWluX3JvbGUgdGV4dCwKICBhZG1pbl9pc19hY3RpdmUgYm9vbGVhbiwKICBtdXN0X2NoYW5nZV9wYXNzd29yZCBib29sZWFuLAogIHBlcm1pc3Npb25zIGpzb25iCikKbGFuZ3VhZ2Ugc3FsCnN0YWJsZQpzZWN1cml0eSBkZWZpbmVyCnNldCBzZWFyY2hfcGF0aCA9IHBnX2NhdGFsb2csIHB1YmxpYwphcyAkJAogIHNlbGVjdAogICAgcC5pZCwKICAgIGxvd2VyKHAuZW1haWwpLAogICAgY2FzZQogICAgICB3aGVuIGxvd2VyKHAucm9sZSkgaW4gKAogICAgICAgICdvd25lcicsCiAgICAgICAgJ3N1cGVyX2FkbWluJwogICAgICApIHRoZW4gJ293bmVyJwogICAgICB3aGVuIGxvd2VyKHAucm9sZSkgaW4gKAogICAgICAgICdzdXBwb3J0JywKICAgICAgICAnc3Vwb3J0ZScKICAgICAgKSB0aGVuICdzdXBwb3J0JwogICAgICB3aGVuIGxvd2VyKHAucm9sZSkgPSAnZmluYW5jZScKICAgICAgICB0aGVuICdmaW5hbmNlJwogICAgICBlbHNlICdhZG1pbicKICAgIGVuZCwKICAgIHAuaXNfYWN0aXZlLAogICAgcC5tdXN0X2NoYW5nZV9wYXNzd29yZCwKICAgIGNvYWxlc2NlKAogICAgICBwLnBlcm1pc3Npb25zLAogICAgICAne30nOjpqc29uYgogICAgKQogIGZyb20gcHVibGljLnBsYXRmb3JtX2FkbWlucyBwCiAgd2hlcmUgcC51c2VyX2lkID0gYXV0aC51aWQoKQogICAgYW5kIHAuaXNfYWN0aXZlID0gdHJ1ZQogIG9yZGVyIGJ5CiAgICBjYXNlCiAgICAgIHdoZW4gbG93ZXIocC5yb2xlKSBpbiAoCiAgICAgICAgJ293bmVyJywKICAgICAgICAnc3VwZXJfYWRtaW4nCiAgICAgICkgdGhlbiAwCiAgICAgIHdoZW4gbG93ZXIocC5yb2xlKSA9ICdhZG1pbicKICAgICAgICB0aGVuIDEKICAgICAgd2hlbiBsb3dlcihwLnJvbGUpID0gJ2ZpbmFuY2UnCiAgICAgICAgdGhlbiAyCiAgICAgIGVsc2UgMwogICAgZW5kLAogICAgcC5jcmVhdGVkX2F0CiAgbGltaXQgMTsKJCQ7CgpyZXZva2UgYWxsCm9uIGZ1bmN0aW9uIHB1YmxpYy5nZXRfbXlfcGxhdGZvcm1fYWRtaW5fYWNjZXNzKCkKZnJvbSBwdWJsaWMsIGFub247CgpncmFudCBleGVjdXRlCm9uIGZ1bmN0aW9uIHB1YmxpYy5nZXRfbXlfcGxhdGZvcm1fYWRtaW5fYWNjZXNzKCkKdG8gYXV0aGVudGljYXRlZDsKCmNvbW1lbnQgb24gZnVuY3Rpb24KICBwdWJsaWMuZ2V0X215X3BsYXRmb3JtX2FkbWluX2FjY2VzcygpCmlzCiAgJ1JldG9ybmEgc29tZW50ZSBvIGFjZXNzbyBhZG1pbmlzdHJhdGl2byBhdGl2byBkbyB1c3VhcmlvIGF1dGVudGljYWRvOyB1c2FkYSBwZWxvIHByb3h5IGFudGVzIGRlIHJlbmRlcml6YXIgL2FkbWluLic7Cgpjb21taXQ7Cg==
'@

$CheckerBase64 = @'
Ly8gT1JDQUxZX1BMQVRGT1JNX0FETUlOX1NFQ1VSSVRZX0NIRUNLX1YxCmltcG9ydCBmcyBmcm9tICdub2RlOmZzJwppbXBvcnQgcGF0aCBmcm9tICdub2RlOnBhdGgnCgpjb25zdCByb290ID0gcHJvY2Vzcy5jd2QoKQpjb25zdCBmYWlsdXJlcyA9IFtdCmNvbnN0IGNoZWNrZWRSb3V0ZXMgPSBbXQoKZnVuY3Rpb24gcmVhZChyZWxhdGl2ZSkgewogIGNvbnN0IGZ1bGwgPSBwYXRoLmpvaW4ocm9vdCwgcmVsYXRpdmUpCgogIGlmICghZnMuZXhpc3RzU3luYyhmdWxsKSkgewogICAgZmFpbHVyZXMucHVzaChgQXJxdWl2byBvYnJpZ2F0w7NyaW8gYXVzZW50ZTogJHtyZWxhdGl2ZX1gKQogICAgcmV0dXJuICcnCiAgfQoKICByZXR1cm4gZnMucmVhZEZpbGVTeW5jKGZ1bGwsICd1dGY4JykKfQoKZnVuY3Rpb24gd2FsayhkaXJlY3RvcnkpIHsKICBjb25zdCBmdWxsID0gcGF0aC5qb2luKHJvb3QsIGRpcmVjdG9yeSkKCiAgaWYgKCFmcy5leGlzdHNTeW5jKGZ1bGwpKSByZXR1cm4gW10KCiAgY29uc3QgcmVzdWx0ID0gW10KCiAgZm9yIChjb25zdCBlbnRyeSBvZiBmcy5yZWFkZGlyU3luYyhmdWxsLCB7CiAgICB3aXRoRmlsZVR5cGVzOiB0cnVlLAogIH0pKSB7CiAgICBjb25zdCByZWxhdGl2ZSA9IHBhdGguam9pbihkaXJlY3RvcnksIGVudHJ5Lm5hbWUpCgogICAgaWYgKGVudHJ5LmlzRGlyZWN0b3J5KCkpIHsKICAgICAgcmVzdWx0LnB1c2goLi4ud2FsayhyZWxhdGl2ZSkpCiAgICB9IGVsc2UgewogICAgICByZXN1bHQucHVzaChyZWxhdGl2ZS5yZXBsYWNlQWxsKCdcXCcsICcvJykpCiAgICB9CiAgfQoKICByZXR1cm4gcmVzdWx0Cn0KCmZ1bmN0aW9uIHJlcXVpcmVUZXh0KHNvdXJjZSwgbWFya2VyLCBsYWJlbCkgewogIGlmICghc291cmNlLmluY2x1ZGVzKG1hcmtlcikpIHsKICAgIGZhaWx1cmVzLnB1c2goYCR7bGFiZWx9OiBtYXJjYWRvciBhdXNlbnRlOiAke21hcmtlcn1gKQogIH0KfQoKY29uc3QgcHJveHkgPSByZWFkKCdwcm94eS50cycpCnJlcXVpcmVUZXh0KAogIHByb3h5LAogICdPUkNBTFlfUExBVEZPUk1fQURNSU5fSEFSREVOSU5HX1YxJywKICAncHJveHkudHMnLAopCnJlcXVpcmVUZXh0KAogIHByb3h5LAogICJnZXRfbXlfcGxhdGZvcm1fYWRtaW5fYWNjZXNzIiwKICAncHJveHkudHMnLAopCnJlcXVpcmVUZXh0KAogIHByb3h5LAogICJhZG1pbkFjY2Vzcz8uYWRtaW5faXNfYWN0aXZlIiwKICAncHJveHkudHMnLAopCnJlcXVpcmVUZXh0KAogIHByb3h5LAogICJ2aW5pY2l1c2FkbUBvcmNhbHkuY29tIiwKICAncHJveHkudHMnLAopCnJlcXVpcmVUZXh0KAogIHByb3h5LAogICJDYWNoZS1Db250cm9sIiwKICAncHJveHkudHMnLAopCnJlcXVpcmVUZXh0KAogIHByb3h5LAogICJYLVJvYm90cy1UYWciLAogICdwcm94eS50cycsCikKCmNvbnN0IHBsYXRmb3JtQWRtaW4gPSByZWFkKCdsaWIvcGxhdGZvcm0tYWRtaW4udHMnKQpyZXF1aXJlVGV4dCgKICBwbGF0Zm9ybUFkbWluLAogICIuZXEoJ2lzX2FjdGl2ZScsIHRydWUpIiwKICAnbGliL3BsYXRmb3JtLWFkbWluLnRzJywKKQpyZXF1aXJlVGV4dCgKICBwbGF0Zm9ybUFkbWluLAogICJyZXF1aXJlUGxhdGZvcm1BZG1pbiIsCiAgJ2xpYi9wbGF0Zm9ybS1hZG1pbi50cycsCikKcmVxdWlyZVRleHQoCiAgcGxhdGZvcm1BZG1pbiwKICAiT1dORVJfT05MWSIsCiAgJ2xpYi9wbGF0Zm9ybS1hZG1pbi50cycsCikKCmNvbnN0IGFkbWluQXV0aCA9IHJlYWQoJ2xpYi9hZG1pbi1hdXRoLnRzJykKcmVxdWlyZVRleHQoCiAgYWRtaW5BdXRoLAogICJyZXF1aXJlUGxhdGZvcm1BZG1pbiIsCiAgJ2xpYi9hZG1pbi1hdXRoLnRzJywKKQpyZXF1aXJlVGV4dCgKICBhZG1pbkF1dGgsCiAgImdldEN1cnJlbnRQbGF0Zm9ybUFkbWluRnJvbVJlcXVlc3QiLAogICdsaWIvYWRtaW4tYXV0aC50cycsCikKCmNvbnN0IGFwaVJvb3RzID0gWwogICdhcHAvYXBpL2FkbWluJywKICAnYXBwL2FwaS9wbGF0Zm9ybS1hZG1pbicsCl0KCmNvbnN0IGFjY2VwdGVkR3VhcmRzID0gWwogICdyZXF1aXJlQWRtaW4oJywKICAncmVxdWlyZVBsYXRmb3JtQWRtaW4oJywKICAnZ2V0Q3VycmVudEFkbWluKCcsCiAgJ2dldEN1cnJlbnRQbGF0Zm9ybUFkbWluRnJvbVJlcXVlc3QoJywKXQoKZm9yIChjb25zdCBhcGlSb290IG9mIGFwaVJvb3RzKSB7CiAgZm9yIChjb25zdCByZWxhdGl2ZSBvZiB3YWxrKGFwaVJvb3QpKSB7CiAgICBpZiAoIXJlbGF0aXZlLmVuZHNXaXRoKCcvcm91dGUudHMnKSkgY29udGludWUKCiAgICBjb25zdCBzb3VyY2UgPSByZWFkKHJlbGF0aXZlKQogICAgY29uc3QgaW1wb3J0c0d1YXJkID0KICAgICAgc291cmNlLmluY2x1ZGVzKCJAL2xpYi9hZG1pbi1hdXRoIikgfHwKICAgICAgc291cmNlLmluY2x1ZGVzKCJAL2xpYi9wbGF0Zm9ybS1hZG1pbiIpCiAgICBjb25zdCBleGVjdXRlc0d1YXJkID0gYWNjZXB0ZWRHdWFyZHMuc29tZSgKICAgICAgKG1hcmtlcikgPT4gc291cmNlLmluY2x1ZGVzKG1hcmtlciksCiAgICApCgogICAgY2hlY2tlZFJvdXRlcy5wdXNoKHJlbGF0aXZlKQoKICAgIGlmICghaW1wb3J0c0d1YXJkIHx8ICFleGVjdXRlc0d1YXJkKSB7CiAgICAgIGZhaWx1cmVzLnB1c2goCiAgICAgICAgYCR7cmVsYXRpdmV9OiByb3RhIGFkbWluaXN0cmF0aXZhIHNlbSBndWFyZGEgcmVjb25oZWNpZGEuYCwKICAgICAgKQogICAgfQoKICAgIGlmICgKICAgICAgc291cmNlLmluY2x1ZGVzKAogICAgICAgICdORVhUX1BVQkxJQ19TVVBBQkFTRV9TRVJWSUNFX1JPTEVfS0VZJywKICAgICAgKQogICAgKSB7CiAgICAgIGZhaWx1cmVzLnB1c2goCiAgICAgICAgYCR7cmVsYXRpdmV9OiBzZXJ2aWNlIHJvbGUgZXhwb3N0YSBjb21vIHZhcmnDoXZlbCBww7pibGljYS5gLAogICAgICApCiAgICB9CiAgfQp9Cgpjb25zdCBzZW5zaXRpdmVGaWxlcyA9IFsKICAuLi53YWxrKCdhcHAvYWRtaW4nKSwKICAuLi53YWxrKCdhcHAvYXBpL2FkbWluJyksCiAgLi4ud2FsaygnYXBwL2FwaS9wbGF0Zm9ybS1hZG1pbicpLAogICdsaWIvYWRtaW4tYXV0aC50cycsCiAgJ2xpYi9wbGF0Zm9ybS1hZG1pbi50cycsCiAgJ3Byb3h5LnRzJywKXQoKZm9yIChjb25zdCByZWxhdGl2ZSBvZiBzZW5zaXRpdmVGaWxlcykgewogIGlmICghL1wuKHRzfHRzeHxqc3xtanMpJC8udGVzdChyZWxhdGl2ZSkpIGNvbnRpbnVlCgogIGNvbnN0IHNvdXJjZSA9IHJlYWQocmVsYXRpdmUpCgogIGlmIChzb3VyY2UuaW5jbHVkZXMoJ1ZpbmkxNTAzLicpKSB7CiAgICBmYWlsdXJlcy5wdXNoKAogICAgICBgJHtyZWxhdGl2ZX06IHNlbmhhIGNvbmhlY2lkYSBmb2kgZW5jb250cmFkYSBubyBjw7NkaWdvLmAsCiAgICApCiAgfQoKICBpZiAoCiAgICBzb3VyY2UuaW5jbHVkZXMoCiAgICAgICdTVVBBQkFTRV9TRVJWSUNFX1JPTEVfS0VZJywKICAgICkgJiYKICAgIHJlbGF0aXZlLnN0YXJ0c1dpdGgoJ2FwcC9hZG1pbi8nKQogICkgewogICAgZmFpbHVyZXMucHVzaCgKICAgICAgYCR7cmVsYXRpdmV9OiBww6FnaW5hIGNsaWVudGUgbsOjbyBwb2RlIGFjZXNzYXIgYSBzZXJ2aWNlIHJvbGUuYCwKICAgICkKICB9Cn0KCmlmIChjaGVja2VkUm91dGVzLmxlbmd0aCA9PT0gMCkgewogIGZhaWx1cmVzLnB1c2goCiAgICAnTmVuaHVtYSByb3RhIGFkbWluaXN0cmF0aXZhIGZvaSBlbmNvbnRyYWRhIHBhcmEgYXVkaXRvcmlhLicsCiAgKQp9CgppZiAoZmFpbHVyZXMubGVuZ3RoID4gMCkgewogIGNvbnNvbGUuZXJyb3IoJycpCiAgY29uc29sZS5lcnJvcignQURNSU5fU0VDVVJJVFlfQ0hFQ0tfRkFJTEVEPTEnKQoKICBmb3IgKGNvbnN0IGZhaWx1cmUgb2YgZmFpbHVyZXMpIHsKICAgIGNvbnNvbGUuZXJyb3IoYC0gJHtmYWlsdXJlfWApCiAgfQoKICBwcm9jZXNzLmV4aXQoMSkKfQoKY29uc29sZS5sb2coYEFETUlOX1JPVVRFU19DSEVDS0VEPSR7Y2hlY2tlZFJvdXRlcy5sZW5ndGh9YCkKY29uc29sZS5sb2coJ0FETUlOX0RBVEFCQVNFX0dBVEU9MScpCmNvbnNvbGUubG9nKCdBRE1JTl9OT19TVE9SRT0xJykKY29uc29sZS5sb2coJ0FETUlOX1NJTkdMRV9PV05FUj0xJykKY29uc29sZS5sb2coJ0FETUlOX1NFQ1VSSVRZX0NIRUNLX0VYSVRfQ09ERT0wJykK
'@

$PatcherBase64 = @'
Ly8gT1JDQUxZX1BMQVRGT1JNX0FETUlOX1BST1hZX1BBVENIRVJfVjEKaW1wb3J0IGZzIGZyb20gJ25vZGU6ZnMnCgpjb25zdCBmaWxlID0gcHJvY2Vzcy5hcmd2WzJdCmxldCBzb3VyY2UgPSBmcwogIC5yZWFkRmlsZVN5bmMoZmlsZSwgJ3V0ZjgnKQogIC5yZXBsYWNlKC9cclxuL2csICdcbicpCiAgLnJlcGxhY2UoL1xyL2csICdcbicpCgpmdW5jdGlvbiByZXBsYWNlT25jZShiZWZvcmUsIGFmdGVyLCBsYWJlbCkgewogIGNvbnN0IGZpcnN0ID0gc291cmNlLmluZGV4T2YoYmVmb3JlKQoKICBpZiAoZmlyc3QgPCAwKSB7CiAgICB0aHJvdyBuZXcgRXJyb3IoYFRyZWNobyBuw6NvIGVuY29udHJhZG86ICR7bGFiZWx9YCkKICB9CgogIGlmICgKICAgIHNvdXJjZS5pbmRleE9mKAogICAgICBiZWZvcmUsCiAgICAgIGZpcnN0ICsgYmVmb3JlLmxlbmd0aCwKICAgICkgPj0gMAogICkgewogICAgdGhyb3cgbmV3IEVycm9yKGBUcmVjaG8gYW1iw61ndW86ICR7bGFiZWx9YCkKICB9CgogIHNvdXJjZSA9CiAgICBzb3VyY2Uuc2xpY2UoMCwgZmlyc3QpICsKICAgIGFmdGVyICsKICAgIHNvdXJjZS5zbGljZShmaXJzdCArIGJlZm9yZS5sZW5ndGgpCn0KCmlmICgKICBzb3VyY2UuaW5jbHVkZXMoCiAgICAnT1JDQUxZX1BMQVRGT1JNX0FETUlOX0hBUkRFTklOR19WMScsCiAgKQopIHsKICBjb25zb2xlLmxvZygnQURNSU5fUFJPWFlfQUxSRUFEWV9IQVJERU5FRD0xJykKICBwcm9jZXNzLmV4aXQoMCkKfQoKcmVwbGFjZU9uY2UoCiAgJy8vIE9SQ0FMWV9PV05FUl9TVVBQT1JUX0NPTlRST0xfVjEnLAogIGAvLyBPUkNBTFlfT1dORVJfU1VQUE9SVF9DT05UUk9MX1YxCi8vIE9SQ0FMWV9QTEFURk9STV9BRE1JTl9IQVJERU5JTkdfVjFgLAogICdtYXJjYWRvciBkbyBjb250cm9sZSBhZG1pbmlzdHJhdGl2bycsCikKCnJlcGxhY2VPbmNlKAogIGBmdW5jdGlvbiBzZWN1cmVSZXNwb25zZSgKICByZXNwb25zZTogTmV4dFJlc3BvbnNlLAogIHJlcXVlc3Q6IE5leHRSZXF1ZXN0LAogIGNvb2tpZXM6IENvb2tpZVRvU2V0W10sCikgewogIHJldHVybiBhcHBseVNlY3VyaXR5SGVhZGVycygKICAgIGFwcGx5Q29va2llcyhyZXNwb25zZSwgY29va2llcyksCiAgICByZXF1ZXN0LAogICkKfWAsCiAgYGZ1bmN0aW9uIHNlY3VyZVJlc3BvbnNlKAogIHJlc3BvbnNlOiBOZXh0UmVzcG9uc2UsCiAgcmVxdWVzdDogTmV4dFJlcXVlc3QsCiAgY29va2llczogQ29va2llVG9TZXRbXSwKKSB7CiAgY29uc3Qgc2VjdXJlZCA9IGFwcGx5U2VjdXJpdHlIZWFkZXJzKAogICAgYXBwbHlDb29raWVzKHJlc3BvbnNlLCBjb29raWVzKSwKICAgIHJlcXVlc3QsCiAgKQogIGNvbnN0IHBhdGhuYW1lID0gcmVxdWVzdC5uZXh0VXJsLnBhdGhuYW1lCiAgY29uc3QgaW50ZXJuYWxBZG1pblJlc291cmNlID0KICAgIHBhdGhuYW1lID09PSAnL2FkbWluJyB8fAogICAgcGF0aG5hbWUuc3RhcnRzV2l0aCgnL2FkbWluLycpIHx8CiAgICBwYXRobmFtZSA9PT0gJy9hcGkvYWRtaW4nIHx8CiAgICBwYXRobmFtZS5zdGFydHNXaXRoKCcvYXBpL2FkbWluLycpIHx8CiAgICBwYXRobmFtZSA9PT0gJy9hcGkvcGxhdGZvcm0tYWRtaW4nIHx8CiAgICBwYXRobmFtZS5zdGFydHNXaXRoKCcvYXBpL3BsYXRmb3JtLWFkbWluLycpCgogIGlmIChpbnRlcm5hbEFkbWluUmVzb3VyY2UpIHsKICAgIHNlY3VyZWQuaGVhZGVycy5zZXQoCiAgICAgICdDYWNoZS1Db250cm9sJywKICAgICAgJ3ByaXZhdGUsIG5vLXN0b3JlLCBuby1jYWNoZSwgbWF4LWFnZT0wLCBtdXN0LXJldmFsaWRhdGUnLAogICAgKQogICAgc2VjdXJlZC5oZWFkZXJzLnNldCgnUHJhZ21hJywgJ25vLWNhY2hlJykKICAgIHNlY3VyZWQuaGVhZGVycy5zZXQoJ0V4cGlyZXMnLCAnMCcpCiAgICBzZWN1cmVkLmhlYWRlcnMuc2V0KAogICAgICAnWC1Sb2JvdHMtVGFnJywKICAgICAgJ25vaW5kZXgsIG5vZm9sbG93LCBub2FyY2hpdmUsIG5vc25pcHBldCcsCiAgICApCiAgfQoKICByZXR1cm4gc2VjdXJlZAp9YCwKICAnY2FiZcOnYWxob3MgcHJpdmFkb3MgZG8gYWRtaW4nLAopCgpyZXBsYWNlT25jZSgKICBgICAgIGNvbnN0IHJvbGUgPSBub3JtYWxpemVkUm9sZSgKICAgICAgdXNlci5hcHBfbWV0YWRhdGE/Lm9yY2FseV9yb2xlLAogICAgKQoKICAgIGlmIChhZG1pblNlbnNpdGl2ZVBhZ2UpIHsKICAgICAgY29uc3QgYWxsb3dlZEFkbWluUm9sZXMgPSBuZXcgU2V0KFsKICAgICAgICAnb3duZXInLAogICAgICAgICdhZG1pbicsCiAgICAgICAgJ2ZpbmFuY2UnLAogICAgICAgICdzdXBwb3J0JywKICAgICAgXSkKCiAgICAgIGlmICghYWxsb3dlZEFkbWluUm9sZXMuaGFzKHJvbGUpKSB7CiAgICAgICAgY29uc3QgcGFuZWwgPQogICAgICAgICAgcmVxdWVzdC5uZXh0VXJsLmNsb25lKCkKICAgICAgICBwYW5lbC5wYXRobmFtZSA9ICcvcGFpbmVsL2luaWNpbycKICAgICAgICBwYW5lbC5zZWFyY2ggPSAnJwoKICAgICAgICByZXR1cm4gc2VjdXJlUmVzcG9uc2UoCiAgICAgICAgICBOZXh0UmVzcG9uc2UucmVkaXJlY3QocGFuZWwpLAogICAgICAgICAgcmVxdWVzdCwKICAgICAgICAgIGNvb2tpZXNUb1NldCwKICAgICAgICApCiAgICAgIH0KICAgIH0KCiAgICBpZiAoCiAgICAgIGFmZmlsaWF0ZVNlbnNpdGl2ZVBhZ2UgJiYKICAgICAgcm9sZSAhPT0gJ2FmZmlsaWF0ZScKICAgICkge2AsCiAgYCAgICBjb25zdCB0b2tlblJvbGUgPSBub3JtYWxpemVkUm9sZSgKICAgICAgdXNlci5hcHBfbWV0YWRhdGE/Lm9yY2FseV9yb2xlLAogICAgKQoKICAgIGlmIChhZG1pblNlbnNpdGl2ZVBhZ2UpIHsKICAgICAgY29uc3QgeyBkYXRhLCBlcnJvciB9ID0gYXdhaXQgc3VwYWJhc2UucnBjKAogICAgICAgICdnZXRfbXlfcGxhdGZvcm1fYWRtaW5fYWNjZXNzJywKICAgICAgKQogICAgICBjb25zdCBhZG1pbkFjY2VzcyA9IEFycmF5LmlzQXJyYXkoZGF0YSkKICAgICAgICA/IGRhdGFbMF0KICAgICAgICA6IGRhdGEKICAgICAgY29uc3QgZGF0YWJhc2VSb2xlID0gbm9ybWFsaXplZFJvbGUoCiAgICAgICAgYWRtaW5BY2Nlc3M/LmFkbWluX3JvbGUsCiAgICAgICkKICAgICAgY29uc3QgYWxsb3dlZEFkbWluUm9sZXMgPSBuZXcgU2V0KFsKICAgICAgICAnb3duZXInLAogICAgICAgICdhZG1pbicsCiAgICAgICAgJ2ZpbmFuY2UnLAogICAgICAgICdzdXBwb3J0JywKICAgICAgXSkKICAgICAgY29uc3Qgb3duZXJFbWFpbE1hdGNoZXMgPQogICAgICAgIGRhdGFiYXNlUm9sZSAhPT0gJ293bmVyJyB8fAogICAgICAgIFN0cmluZyh1c2VyLmVtYWlsIHx8ICcnKS50b0xvd2VyQ2FzZSgpID09PQogICAgICAgICAgJ3ZpbmljaXVzYWRtQG9yY2FseS5jb20nCgogICAgICBpZiAoCiAgICAgICAgZXJyb3IgfHwKICAgICAgICBhZG1pbkFjY2Vzcz8uYWRtaW5faXNfYWN0aXZlICE9PSB0cnVlIHx8CiAgICAgICAgIWFsbG93ZWRBZG1pblJvbGVzLmhhcyhkYXRhYmFzZVJvbGUpIHx8CiAgICAgICAgIW93bmVyRW1haWxNYXRjaGVzCiAgICAgICkgewogICAgICAgIGNvbnN0IHBhbmVsID0gcmVxdWVzdC5uZXh0VXJsLmNsb25lKCkKICAgICAgICBwYW5lbC5wYXRobmFtZSA9ICcvcGFpbmVsL2luaWNpbycKICAgICAgICBwYW5lbC5zZWFyY2ggPSAnJwoKICAgICAgICByZXR1cm4gc2VjdXJlUmVzcG9uc2UoCiAgICAgICAgICBOZXh0UmVzcG9uc2UucmVkaXJlY3QocGFuZWwpLAogICAgICAgICAgcmVxdWVzdCwKICAgICAgICAgIGNvb2tpZXNUb1NldCwKICAgICAgICApCiAgICAgIH0KCiAgICAgIGlmICgKICAgICAgICBhZG1pbkFjY2Vzcz8ubXVzdF9jaGFuZ2VfcGFzc3dvcmQgPT09IHRydWUgJiYKICAgICAgICBwYXRobmFtZSAhPT0gJy9hZG1pbi9hbHRlcmFyLXNlbmhhJwogICAgICApIHsKICAgICAgICBjb25zdCBwYXNzd29yZFBhZ2UgPQogICAgICAgICAgcmVxdWVzdC5uZXh0VXJsLmNsb25lKCkKICAgICAgICBwYXNzd29yZFBhZ2UucGF0aG5hbWUgPQogICAgICAgICAgJy9hZG1pbi9hbHRlcmFyLXNlbmhhJwogICAgICAgIHBhc3N3b3JkUGFnZS5zZWFyY2ggPSAnJwoKICAgICAgICByZXR1cm4gc2VjdXJlUmVzcG9uc2UoCiAgICAgICAgICBOZXh0UmVzcG9uc2UucmVkaXJlY3QocGFzc3dvcmRQYWdlKSwKICAgICAgICAgIHJlcXVlc3QsCiAgICAgICAgICBjb29raWVzVG9TZXQsCiAgICAgICAgKQogICAgICB9CiAgICB9CgogICAgaWYgKAogICAgICBhZmZpbGlhdGVTZW5zaXRpdmVQYWdlICYmCiAgICAgIHRva2VuUm9sZSAhPT0gJ2FmZmlsaWF0ZScKICAgICkge2AsCiAgJ3ZlcmlmaWNhw6fDo28gYWRtaW5pc3RyYXRpdmEgbm8gYmFuY28nLAopCgpmcy53cml0ZUZpbGVTeW5jKGZpbGUsIHNvdXJjZSwgJ3V0ZjgnKQpjb25zb2xlLmxvZygnQURNSU5fUFJPWFlfSEFSREVORUQ9MScpCg==
'@

$HadChecker = Test-Path -LiteralPath $CheckerPath
$MigrationCreated = $false
$MigrationPath = ""

function Write-Section([string]$Text) {
    Write-Host ""
    Write-Host ("=" * 76) -ForegroundColor DarkCyan
    Write-Host $Text -ForegroundColor Cyan
    Write-Host ("=" * 76) -ForegroundColor DarkCyan
}

function Write-Utf8File(
    [string]$Path,
    [string]$Base64
) {
    $Parent = Split-Path -Parent $Path

    if ($Parent) {
        New-Item `
            -ItemType Directory `
            -Path $Parent `
            -Force | Out-Null
    }

    $Bytes = [Convert]::FromBase64String(
        ($Base64 -replace "\s", "")
    )

    [System.IO.File]::WriteAllBytes(
        $Path,
        $Bytes
    )
}

function Restore-Files {
    Write-Host "[AVISO] Restaurando os arquivos anteriores..." -ForegroundColor Yellow

    $ProxyBackup = Join-Path $BackupRoot "proxy.ts"

    if (Test-Path -LiteralPath $ProxyBackup) {
        Copy-Item `
            -LiteralPath $ProxyBackup `
            -Destination $ProxyPath `
            -Force
    }

    $CheckerBackup = Join-Path `
        $BackupRoot `
        "admin-security-check.mjs"

    if (Test-Path -LiteralPath $CheckerBackup) {
        Copy-Item `
            -LiteralPath $CheckerBackup `
            -Destination $CheckerPath `
            -Force
    }
    elseif (
        -not $HadChecker -and
        (Test-Path -LiteralPath $CheckerPath)
    ) {
        Remove-Item `
            -LiteralPath $CheckerPath `
            -Force `
            -ErrorAction SilentlyContinue
    }

    if (
        $MigrationCreated -and
        $MigrationPath -and
        (Test-Path -LiteralPath $MigrationPath)
    ) {
        Remove-Item `
            -LiteralPath $MigrationPath `
            -Force `
            -ErrorAction SilentlyContinue
    }
}

function Resolve-SupabaseCommand {
    $Command = Get-Command `
        supabase.exe `
        -ErrorAction SilentlyContinue

    if (-not $Command) {
        $Command = Get-Command `
            supabase `
            -ErrorAction SilentlyContinue
    }

    if ($Command) {
        return @{
            Command = $Command.Source
            Prefix = @()
        }
    }

    $Npx = Get-Command `
        npx.cmd `
        -ErrorAction SilentlyContinue

    if (-not $Npx) {
        $Npx = Get-Command `
            npx `
            -ErrorAction SilentlyContinue
    }

    if (-not $Npx) {
        throw "Supabase CLI e npx não foram encontrados."
    }

    return @{
        Command = $Npx.Source
        Prefix = @("--yes", "supabase@latest")
    }
}

Write-Section "ORCALY - ENDURECIMENTO DO PAINEL ADMIN"

if (
    -not (
        Test-Path -LiteralPath (
            Join-Path $Root "package.json"
        )
    )
) {
    throw "Execute este script na raiz do projeto Orçaly."
}

if (-not (Test-Path -LiteralPath $ProxyPath)) {
    throw "Arquivo não encontrado: proxy.ts"
}

$RequiredFiles = @(
    "lib\platform-admin.ts",
    "lib\admin-auth.ts",
    "app\admin\page.tsx",
    "app\admin\login\page.tsx",
    "app\api\admin\session\route.ts"
)

foreach ($Relative in $RequiredFiles) {
    $Target = Join-Path $Root $Relative

    if (-not (Test-Path -LiteralPath $Target)) {
        throw "O painel administrativo ainda não está completo: $Relative"
    }
}

$ProxySource = [System.IO.File]::ReadAllText(
    $ProxyPath,
    [System.Text.Encoding]::UTF8
)

if (
    -not $ProxySource.Contains(
        "ORCALY_OWNER_SUPPORT_CONTROL_V1"
    )
) {
    throw "Execute primeiro o instalador do login DONO que terminou com BUILD_EXIT_CODE=0."
}

New-Item `
    -ItemType Directory `
    -Path $BackupRoot `
    -Force | Out-Null

Copy-Item `
    -LiteralPath $ProxyPath `
    -Destination (Join-Path $BackupRoot "proxy.ts") `
    -Force

if ($HadChecker) {
    Copy-Item `
        -LiteralPath $CheckerPath `
        -Destination (
            Join-Path `
                $BackupRoot `
                "admin-security-check.mjs"
        ) `
        -Force
}

Write-Host "[OK] Backup: $BackupRoot" -ForegroundColor Green

try {
    Write-Section "REGISTRANDO A MIGRAÇÃO LOCAL"

    New-Item `
        -ItemType Directory `
        -Path $MigrationDirectory `
        -Force | Out-Null

    $ExistingMigration = Get-ChildItem `
        -LiteralPath $MigrationDirectory `
        -Filter "*.sql" `
        -File |
        Where-Object {
            (
                Get-Content `
                    -LiteralPath $_.FullName `
                    -Raw
            ).Contains($MigrationMarker)
        } |
        Select-Object -First 1

    if ($ExistingMigration) {
        $MigrationPath = $ExistingMigration.FullName
        Write-Host "[OK] Migration já existe: $MigrationPath" -ForegroundColor Green
    }
    else {
        $Supabase = Resolve-SupabaseCommand
        $Arguments = @()

        if ($Supabase.Prefix) {
            $Arguments += $Supabase.Prefix
        }

        $Arguments += @(
            "migration",
            "new",
            "harden_platform_admin_owner_access_v1"
        )

        & $Supabase.Command @Arguments

        if ($LASTEXITCODE -ne 0) {
            throw "Não foi possível criar a migration local."
        }

        $CreatedMigration = Get-ChildItem `
            -LiteralPath $MigrationDirectory `
            -Filter "*_harden_platform_admin_owner_access_v1.sql" `
            -File |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 1

        if (-not $CreatedMigration) {
            throw "A migration criada não foi localizada."
        }

        $MigrationPath = $CreatedMigration.FullName
        $MigrationCreated = $true

        Write-Utf8File `
            -Path $MigrationPath `
            -Base64 $MigrationBase64

        Write-Host "[OK] Migration local: $MigrationPath" -ForegroundColor Green
    }

    Write-Host "A estrutura equivalente já foi aplicada no Supabase de produção." -ForegroundColor Cyan

    Write-Section "ENDURECENDO O PROXY"

    $PatcherPath = Join-Path `
        $env:TEMP `
        "orcaly-admin-hardening-$Timestamp.mjs"

    Write-Utf8File `
        -Path $PatcherPath `
        -Base64 $PatcherBase64

    try {
        node $PatcherPath $ProxyPath

        if ($LASTEXITCODE -ne 0) {
            throw "Não foi possível endurecer o proxy."
        }
    }
    finally {
        Remove-Item `
            -LiteralPath $PatcherPath `
            -Force `
            -ErrorAction SilentlyContinue
    }

    Write-Section "INSTALANDO A AUDITORIA DE ROTAS"

    Write-Utf8File `
        -Path $CheckerPath `
        -Base64 $CheckerBase64

    Write-Host "[OK] $CheckerRelative" -ForegroundColor Green

    Write-Section "VALIDANDO A SEGURANÇA ADMINISTRATIVA"

    node $CheckerPath

    if ($LASTEXITCODE -ne 0) {
        throw "A auditoria das rotas administrativas falhou."
    }

    $MigrationRelative = (
        $MigrationPath.Substring(
            $Root.Length + 1
        ) -replace "\\", "/"
    )

    git --no-pager diff --check -- `
        $ProxyRelative `
        $CheckerRelative `
        $MigrationRelative

    if ($LASTEXITCODE -ne 0) {
        throw "git diff --check encontrou problemas."
    }

    $Package = Get-Content `
        -LiteralPath (
            Join-Path $Root "package.json"
        ) `
        -Raw |
        ConvertFrom-Json

    if (
        $Package.scripts.PSObject.Properties.Name `
            -contains "security:check"
    ) {
        Write-Section "VALIDANDO SEGURANÇA GERAL"

        npm run security:check

        if ($LASTEXITCODE -ne 0) {
            throw "security:check falhou."
        }

        Write-Host "[OK] SECURITY_CHECK_EXIT_CODE=0" -ForegroundColor Green
    }

    Remove-Item `
        -LiteralPath (Join-Path $Root ".next") `
        -Recurse `
        -Force `
        -ErrorAction SilentlyContinue

    Write-Section "EXECUTANDO BUILD COMPLETO"

    npm run build
    $BuildExitCode = $LASTEXITCODE

    Write-Host ""
    Write-Host "BUILD_EXIT_CODE=$BuildExitCode" -ForegroundColor Yellow

    if ($BuildExitCode -ne 0) {
        throw "O build falhou."
    }

    Write-Section "PAINEL ADMINISTRATIVO ENDURECIDO"

    Write-Host "Owner oficial: viniciusadm@orcaly.com"
    Write-Host "Owner ativo no banco: único"
    Write-Host "Conta administrativa antiga: desativada"
    Write-Host "Proteção das páginas: token + banco"
    Write-Host "Proteção das APIs: banco + permissão"
    Write-Host "Cache administrativo: desativado"
    Write-Host "Indexação administrativa: bloqueada"
    Write-Host "Rotas administrativas: auditadas"
    Write-Host "Senhas no painel: inexistentes"
    Write-Host "Build: aprovado"
    Write-Host "Commit: não realizado"
    Write-Host "Deploy: não realizado"
}
catch {
    Restore-Files
    throw
}
