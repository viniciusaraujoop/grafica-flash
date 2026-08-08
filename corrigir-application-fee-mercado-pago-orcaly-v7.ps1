param(
    [string]$Branch = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$env:GIT_PAGER = "cat"
$env:NPM_CONFIG_LOGLEVEL = "error"

$Root = (Get-Location).Path
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupRoot = Join-Path `
    $Root `
    ".orcaly-backups\mp-application-fee-$Timestamp"

$Files = @(
    "lib/payments/checkout-service.ts",
    "app/api/marketplace/payments/mercado-pago/callback/route.ts",
    "components/checkout/CheckoutClient.tsx"
)

$CommitMessage = "fix: valida oauth marketplace no split Mercado Pago"
$InstallerVersion = "V7_REAL_DEPENDENCY_INSTALL"
$PatchApplied = $false
$CommitCreated = $false

$PatcherBase64 = @'
aW1wb3J0IGZzIGZyb20gIm5vZGU6ZnMiOwppbXBvcnQgcGF0aCBmcm9tICJub2RlOnBhdGgiOwoKY29uc3Qgcm9vdCA9IHByb2Nlc3MuYXJndlsyXTsKaWYgKCFyb290KSB0aHJvdyBuZXcgRXJyb3IoIlJhaXogZG8gcHJvamV0byBuw6NvIGluZm9ybWFkYS4iKTsKCmZ1bmN0aW9uIGZpbGUocmVsYXRpdmUpIHsKICByZXR1cm4gcGF0aC5qb2luKHJvb3QsIHJlbGF0aXZlKTsKfQoKZnVuY3Rpb24gcmVhZChyZWxhdGl2ZSkgewogIHJldHVybiBmcwogICAgLnJlYWRGaWxlU3luYyhmaWxlKHJlbGF0aXZlKSwgInV0ZjgiKQogICAgLnJlcGxhY2UoL1xyXG4vZywgIlxuIikKICAgIC5yZXBsYWNlKC9cci9nLCAiXG4iKTsKfQoKZnVuY3Rpb24gd3JpdGUocmVsYXRpdmUsIGNvbnRlbnQpIHsKICBmcy53cml0ZUZpbGVTeW5jKGZpbGUocmVsYXRpdmUpLCBjb250ZW50LCAidXRmOCIpOwp9CgpmdW5jdGlvbiByZXBsYWNlT25jZShzb3VyY2UsIGJlZm9yZSwgYWZ0ZXIsIGxhYmVsKSB7CiAgY29uc3QgaW5kZXggPSBzb3VyY2UuaW5kZXhPZihiZWZvcmUpOwogIGlmIChpbmRleCA8IDApIHsKICAgIHRocm93IG5ldyBFcnJvcihgVHJlY2hvIG7Do28gZW5jb250cmFkbzogJHtsYWJlbH1gKTsKICB9CiAgaWYgKHNvdXJjZS5pbmRleE9mKGJlZm9yZSwgaW5kZXggKyBiZWZvcmUubGVuZ3RoKSA+PSAwKSB7CiAgICB0aHJvdyBuZXcgRXJyb3IoYFRyZWNobyBhbWLDrWd1bzogJHtsYWJlbH1gKTsKICB9CiAgcmV0dXJuICgKICAgIHNvdXJjZS5zbGljZSgwLCBpbmRleCkgKwogICAgYWZ0ZXIgKwogICAgc291cmNlLnNsaWNlKGluZGV4ICsgYmVmb3JlLmxlbmd0aCkKICApOwp9Cgpjb25zdCBzZXJ2aWNlUGF0aCA9ICJsaWIvcGF5bWVudHMvY2hlY2tvdXQtc2VydmljZS50cyI7CmNvbnN0IGNhbGxiYWNrUGF0aCA9CiAgImFwcC9hcGkvbWFya2V0cGxhY2UvcGF5bWVudHMvbWVyY2Fkby1wYWdvL2NhbGxiYWNrL3JvdXRlLnRzIjsKY29uc3QgY2xpZW50UGF0aCA9ICJjb21wb25lbnRzL2NoZWNrb3V0L0NoZWNrb3V0Q2xpZW50LnRzeCI7CgpsZXQgc2VydmljZSA9IHJlYWQoc2VydmljZVBhdGgpOwpsZXQgY2FsbGJhY2sgPSByZWFkKGNhbGxiYWNrUGF0aCk7CmxldCBjbGllbnQgPSByZWFkKGNsaWVudFBhdGgpOwoKaWYgKCFzZXJ2aWNlLmluY2x1ZGVzKCJPUkNBTFlfTVBfQVBQTElDQVRJT05fRkVFX09BVVRIX1YxIikpIHsKICBzZXJ2aWNlID0gcmVwbGFjZU9uY2UoCiAgICBzZXJ2aWNlLAogICAgJ2ltcG9ydCB7IGdldFBsYW5Db25maWcgfSBmcm9tICJAL2xpYi9wbGFucy9wbGFuLWNvbmZpZyI7JywKICAgIGBpbXBvcnQgeyBnZXRQbGFuQ29uZmlnIH0gZnJvbSAiQC9saWIvcGxhbnMvcGxhbi1jb25maWciOwovLyBPUkNBTFlfTVBfQVBQTElDQVRJT05fRkVFX09BVVRIX1YxYCwKICAgICJpbXBvcnQgbWFya2V0cGxhY2UgY29uZmlnIiwKICApOwoKICBzZXJ2aWNlID0gcmVwbGFjZU9uY2UoCiAgICBzZXJ2aWNlLAogICAgYGZ1bmN0aW9uIGFzUmVjb3JkKHZhbHVlOiB1bmtub3duKTogSnNvblJlY29yZCB7CiAgaWYgKCF2YWx1ZSB8fCB0eXBlb2YgdmFsdWUgIT09ICJvYmplY3QiIHx8IEFycmF5LmlzQXJyYXkodmFsdWUpKSB7CiAgICByZXR1cm4ge307CiAgfQoKICByZXR1cm4gdmFsdWUgYXMgSnNvblJlY29yZDsKfQpgLAogICAgYGZ1bmN0aW9uIGFzUmVjb3JkKHZhbHVlOiB1bmtub3duKTogSnNvblJlY29yZCB7CiAgaWYgKCF2YWx1ZSB8fCB0eXBlb2YgdmFsdWUgIT09ICJvYmplY3QiIHx8IEFycmF5LmlzQXJyYXkodmFsdWUpKSB7CiAgICByZXR1cm4ge307CiAgfQoKICByZXR1cm4gdmFsdWUgYXMgSnNvblJlY29yZDsKfQoKZnVuY3Rpb24gbWFya2V0cGxhY2VQdWJsaWNLZXkoKSB7CiAgcmV0dXJuIHRleHQoCiAgICBwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19NUF9NQVJLRVRQTEFDRV9QVUJMSUNfS0VZLAogICk7Cn0KCmZ1bmN0aW9uIHZlcmlmaWVkTWFya2V0cGxhY2VPYXV0aCh2YWx1ZTogdW5rbm93bikgewogIGNvbnN0IG1ldGFkYXRhID0gYXNSZWNvcmQodmFsdWUpOwogIGNvbnN0IGNvbmZpZ3VyZWRDbGllbnRJZCA9IHRleHQoCiAgICBwcm9jZXNzLmVudi5NUF9NQVJLRVRQTEFDRV9DTElFTlRfSUQsCiAgKTsKCiAgcmV0dXJuIEJvb2xlYW4oCiAgICBjb25maWd1cmVkQ2xpZW50SWQgJiYKICAgICAgbWV0YWRhdGEub2F1dGhfZ3JhbnRfdHlwZSA9PT0gImF1dGhvcml6YXRpb25fY29kZSIgJiYKICAgICAgdGV4dChtZXRhZGF0YS5tYXJrZXRwbGFjZV9jbGllbnRfaWQpID09PQogICAgICAgIGNvbmZpZ3VyZWRDbGllbnRJZCwKICApOwp9CgpmdW5jdGlvbiBtZXJjYWRvUGFnb1Byb3ZpZGVyRXJyb3JDb2RlKGNhdXNlOiB1bmtub3duKSB7CiAgaWYgKCFjYXVzZSB8fCB0eXBlb2YgY2F1c2UgIT09ICJvYmplY3QiKSByZXR1cm4gMDsKCiAgY29uc3QgcHJvdmlkZXJQYXlsb2FkID0KICAgICJwcm92aWRlclBheWxvYWQiIGluIGNhdXNlCiAgICAgID8gYXNSZWNvcmQoCiAgICAgICAgICAoCiAgICAgICAgICAgIGNhdXNlIGFzIHsKICAgICAgICAgICAgICBwcm92aWRlclBheWxvYWQ/OiB1bmtub3duOwogICAgICAgICAgICB9CiAgICAgICAgICApLnByb3ZpZGVyUGF5bG9hZCwKICAgICAgICApCiAgICAgIDoge307CiAgY29uc3QgZGlyZWN0Q29kZSA9IE51bWJlcigKICAgIHByb3ZpZGVyUGF5bG9hZC5jb2RlIHx8CiAgICAgIHByb3ZpZGVyUGF5bG9hZC5zdGF0dXMgfHwKICAgICAgMCwKICApOwoKICBpZiAoZGlyZWN0Q29kZSkgcmV0dXJuIGRpcmVjdENvZGU7CgogIGZvciAoY29uc3QgcmF3Q2F1c2Ugb2YgYXJyYXkocHJvdmlkZXJQYXlsb2FkLmNhdXNlKSkgewogICAgY29uc3QgcmVjb3JkID0gYXNSZWNvcmQocmF3Q2F1c2UpOwogICAgY29uc3QgY29kZSA9IE51bWJlcigKICAgICAgcmVjb3JkLmNvZGUgfHwKICAgICAgICByZWNvcmQuc3RhdHVzIHx8CiAgICAgICAgMCwKICAgICk7CgogICAgaWYgKGNvZGUpIHJldHVybiBjb2RlOwogIH0KCiAgcmV0dXJuIDA7Cn0KYCwKICAgICJvYXV0aCBoZWxwZXJzIiwKICApOwoKICBzZXJ2aWNlID0gcmVwbGFjZU9uY2UoCiAgICBzZXJ2aWNlLAogICAgYCJpZCxhY2Nlc3NfdG9rZW4scmVmcmVzaF90b2tlbixwdWJsaWNfa2V5LHRva2VuX2V4cGlyZXNfYXQsb25ib2FyZGluZ19zdGF0dXMsaXNfYWN0aXZlLGxhc3RfZXJyb3IiLGAsCiAgICBgImlkLGFjY2Vzc190b2tlbixyZWZyZXNoX3Rva2VuLHB1YmxpY19rZXksdG9rZW5fZXhwaXJlc19hdCxvbmJvYXJkaW5nX3N0YXR1cyxpc19hY3RpdmUsbGFzdF9lcnJvcixwcm92aWRlcl9tZXRhZGF0YV9zYW5pdGl6ZWQiLGAsCiAgICAic2VsbGVyIHRva2VuIHNlbGVjdCIsCiAgKTsKCiAgc2VydmljZSA9IHJlcGxhY2VPbmNlKAogICAgc2VydmljZSwKICAgIGAgIGxldCBhY2Nlc3NUb2tlbiA9CiAgICB1bnByb3RlY3RNZXJjYWRvUGFnb1Rva2VuKAogICAgICBzZXR0aW5nLmFjY2Vzc190b2tlbiwKICAgICk7CmAsCiAgICBgICBpZiAoCiAgICAhdmVyaWZpZWRNYXJrZXRwbGFjZU9hdXRoKAogICAgICBzZXR0aW5nLnByb3ZpZGVyX21ldGFkYXRhX3Nhbml0aXplZCwKICAgICkKICApIHsKICAgIHRocm93IE9iamVjdC5hc3NpZ24oCiAgICAgIG5ldyBFcnJvcigKICAgICAgICAiUmVjb25lY3RlIGEgY29udGEgTWVyY2FkbyBQYWdvIHBlbG8gcGFpbmVsLiBBIGNvbmV4w6NvIGF0dWFsIG7Do28gZm9pIHZhbGlkYWRhIGNvbW8gT0F1dGggTWFya2V0cGxhY2UuIiwKICAgICAgKSwKICAgICAgeyBzdGF0dXM6IDQwOSB9LAogICAgKTsKICB9CgogIGxldCBhY2Nlc3NUb2tlbiA9CiAgICB1bnByb3RlY3RNZXJjYWRvUGFnb1Rva2VuKAogICAgICBzZXR0aW5nLmFjY2Vzc190b2tlbiwKICAgICk7CmAsCiAgICAibGVnYWN5IHRva2VuIGd1YXJkIiwKICApOwoKICBzZXJ2aWNlID0gcmVwbGFjZU9uY2UoCiAgICBzZXJ2aWNlLAogICAgYCJhY2Nlc3NfdG9rZW4scHVibGljX2tleSxvbmJvYXJkaW5nX3N0YXR1cyxhY2NvdW50X3N0YXR1cyxpc19hY3RpdmUsY2hhcmdlc19lbmFibGVkLHBpeF9lbmFibGVkLGNhcmRfZW5hYmxlZCxsYXN0X2Vycm9yIixgLAogICAgYCJhY2Nlc3NfdG9rZW4scHVibGljX2tleSxvbmJvYXJkaW5nX3N0YXR1cyxhY2NvdW50X3N0YXR1cyxpc19hY3RpdmUsY2hhcmdlc19lbmFibGVkLHBpeF9lbmFibGVkLGNhcmRfZW5hYmxlZCxsYXN0X2Vycm9yLHByb3ZpZGVyX21ldGFkYXRhX3Nhbml0aXplZCIsYCwKICAgICJjYXRhbG9nIHBheW1lbnQgc2VsZWN0IiwKICApOwoKICBzZXJ2aWNlID0gcmVwbGFjZU9uY2UoCiAgICBzZXJ2aWNlLAogICAgYCAgY29uc3QgcHVibGljS2V5ID0gdGV4dCgKICAgIGFjY291bnQ/LnB1YmxpY19rZXksCiAgKTsKCiAgY29uc3QgY29ubmVjdGVkID0gQm9vbGVhbigKICAgIGFjY291bnQ/LmlzX2FjdGl2ZSAmJgogICAgICBhY2NvdW50Py5hY2Nlc3NfdG9rZW4gJiYKICAgICAgcHVibGljS2V5ICYmCiAgICAgIGFjY291bnQ/Lm9uYm9hcmRpbmdfc3RhdHVzID09PQogICAgICAgICJjb25uZWN0ZWQiLAogICk7CmAsCiAgICBgICBjb25zdCBwdWJsaWNLZXkgPQogICAgbWFya2V0cGxhY2VQdWJsaWNLZXkoKTsKICBjb25zdCBvYXV0aFZlcmlmaWVkID0KICAgIHZlcmlmaWVkTWFya2V0cGxhY2VPYXV0aCgKICAgICAgYWNjb3VudD8ucHJvdmlkZXJfbWV0YWRhdGFfc2FuaXRpemVkLAogICAgKTsKICBjb25zdCBjb25uZWN0aW9uUmVxdWlyZXNSZWNvbm5lY3QgPQogICAgQm9vbGVhbigKICAgICAgYWNjb3VudD8uYWNjZXNzX3Rva2VuICYmCiAgICAgICAgIW9hdXRoVmVyaWZpZWQsCiAgICApOwoKICBjb25zdCBjb25uZWN0ZWQgPSBCb29sZWFuKAogICAgYWNjb3VudD8uaXNfYWN0aXZlICYmCiAgICAgIGFjY291bnQ/LmFjY2Vzc190b2tlbiAmJgogICAgICBwdWJsaWNLZXkgJiYKICAgICAgb2F1dGhWZXJpZmllZCAmJgogICAgICBhY2NvdW50Py5vbmJvYXJkaW5nX3N0YXR1cyA9PT0KICAgICAgICAiY29ubmVjdGVkIiwKICApOwpgLAogICAgImludGVncmF0b3IgcHVibGljIGtleSIsCiAgKTsKCiAgc2VydmljZSA9IHJlcGxhY2VPbmNlKAogICAgc2VydmljZSwKICAgIGAgICAgICBsYXN0RXJyb3I6CiAgICAgICAgYWNjb3VudD8ubGFzdF9lcnJvciB8fCBudWxsLApgLAogICAgYCAgICAgIGxhc3RFcnJvcjoKICAgICAgICBjb25uZWN0aW9uUmVxdWlyZXNSZWNvbm5lY3QKICAgICAgICAgID8gIlJlY29uZWN0ZSBhIGNvbnRhIE1lcmNhZG8gUGFnbyBwYXJhIGF0aXZhciBvIHNwbGl0IGRlIHBhZ2FtZW50b3MuIgogICAgICAgICAgOiAhcHVibGljS2V5CiAgICAgICAgICAgID8gIkEgY2hhdmUgcMO6YmxpY2EgZG8gaW50ZWdyYWRvciBNZXJjYWRvIFBhZ28gbsOjbyBlc3TDoSBjb25maWd1cmFkYS4iCiAgICAgICAgICAgIDogYWNjb3VudD8ubGFzdF9lcnJvciB8fCBudWxsLAogICAgICBjb25uZWN0aW9uUmVxdWlyZXNSZWNvbm5lY3QsCmAsCiAgICAiY2F0YWxvZyByZWNvbm5lY3QgaW5mbyIsCiAgKTsKCiAgc2VydmljZSA9IHJlcGxhY2VPbmNlKAogICAgc2VydmljZSwKICAgIGAgICAgdGhyb3cgY2F1c2U7CiAgfQp9CmAsCiAgICBgICAgIGNvbnN0IHByb3ZpZGVyQ29kZSA9CiAgICAgIG1lcmNhZG9QYWdvUHJvdmlkZXJFcnJvckNvZGUoCiAgICAgICAgY2F1c2UsCiAgICAgICk7CiAgICBjb25zdCBhcHBsaWNhdGlvbkZlZU9hdXRoUmVqZWN0ZWQgPQogICAgICBwcm92aWRlckNvZGUgPT09IDIwNTkgfHwKICAgICAgbWVzc2FnZQogICAgICAgIC50b0xvd2VyQ2FzZSgpCiAgICAgICAgLmluY2x1ZGVzKCJhcHBsaWNhdGlvbl9mZWUiKTsKCiAgICBpZiAoYXBwbGljYXRpb25GZWVPYXV0aFJlamVjdGVkKSB7CiAgICAgIGNvbnN0IHJlY29ubmVjdE1lc3NhZ2UgPQogICAgICAgICJBIGNvbnRhIE1lcmNhZG8gUGFnbyBwcmVjaXNhIHNlciByZWNvbmVjdGFkYSBwb3IgT0F1dGggdXNhbmRvIHVtYSBhcGxpY2HDp8OjbyBjb25maWd1cmFkYSBjb21vIE1hcmtldHBsYWNlLiI7CgogICAgICBhd2FpdCBzdXBhYmFzZQogICAgICAgIC5mcm9tKAogICAgICAgICAgIm1hcmtldHBsYWNlX3BheW1lbnRfc2V0dGluZ3MiLAogICAgICAgICkKICAgICAgICAudXBkYXRlKHsKICAgICAgICAgIG9uYm9hcmRpbmdfc3RhdHVzOgogICAgICAgICAgICAicmVjb25uZWN0X3JlcXVpcmVkIiwKICAgICAgICAgIGNoYXJnZXNfZW5hYmxlZDogZmFsc2UsCiAgICAgICAgICBsYXN0X2Vycm9yOgogICAgICAgICAgICByZWNvbm5lY3RNZXNzYWdlLAogICAgICAgICAgdXBkYXRlZF9hdDoKICAgICAgICAgICAgbmV3IERhdGUoKS50b0lTT1N0cmluZygpLAogICAgICAgIH0pCiAgICAgICAgLmVxKCJjb21wYW55X2lkIiwgY29tcGFueUlkKQogICAgICAgIC5lcSgicHJvdmlkZXIiLCAibWVyY2Fkb19wYWdvIik7CgogICAgICB0aHJvdyBPYmplY3QuYXNzaWduKAogICAgICAgIG5ldyBFcnJvcihyZWNvbm5lY3RNZXNzYWdlKSwKICAgICAgICB7IHN0YXR1czogNDA5IH0sCiAgICAgICk7CiAgICB9CgogICAgdGhyb3cgY2F1c2U7CiAgfQp9CmAsCiAgICAiMjA1OSBoYW5kbGVyIiwKICApOwoKfQoKaWYgKCFjYWxsYmFjay5pbmNsdWRlcygiT1JDQUxZX01QX09BVVRIX1BST09GX1YxIikpIHsKICBjYWxsYmFjayA9IHJlcGxhY2VPbmNlKAogICAgY2FsbGJhY2ssCiAgICBgaW1wb3J0IHsKICBleGNoYW5nZU1lcmNhZG9QYWdvQ29kZSwKICBoYXNoT2F1dGhTdGF0ZSwKICBwcm90ZWN0TWVyY2Fkb1BhZ29Ub2tlbiwKICB2ZXJpZnlNZXJjYWRvUGFnb09hdXRoU3RhdGVBbmRHZXRWZXJpZmllciwKfSBmcm9tICJAL2xpYi9tZXJjYWRvLXBhZ28iOwpgLAogICAgYGltcG9ydCB7CiAgZXhjaGFuZ2VNZXJjYWRvUGFnb0NvZGUsCiAgaGFzaE9hdXRoU3RhdGUsCiAgcHJvdGVjdE1lcmNhZG9QYWdvVG9rZW4sCiAgdmVyaWZ5TWVyY2Fkb1BhZ29PYXV0aFN0YXRlQW5kR2V0VmVyaWZpZXIsCn0gZnJvbSAiQC9saWIvbWVyY2Fkby1wYWdvIjsKaW1wb3J0IHsKICBnZXRNYXJrZXRwbGFjZUNsaWVudElkLAp9IGZyb20gIkAvbGliL3BheW1lbnRzL21hcmtldHBsYWNlL2NvbmZpZyI7Ci8vIE9SQ0FMWV9NUF9PQVVUSF9QUk9PRl9WMQpgLAogICAgImNhbGxiYWNrIGltcG9ydCIsCiAgKTsKCiAgY2FsbGJhY2sgPSByZXBsYWNlT25jZSgKICAgIGNhbGxiYWNrLAogICAgYCAgICAgICAgICBsYXN0X3N0YXR1c19jaGVja19hdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLAogICAgICAgICAgbGFzdF9lcnJvcjogbnVsbCwKICAgICAgICAgIHVwZGF0ZWRfYXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSwKYCwKICAgIGAgICAgICAgICAgbGFzdF9zdGF0dXNfY2hlY2tfYXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSwKICAgICAgICAgIHByb3ZpZGVyX21ldGFkYXRhX3Nhbml0aXplZDogewogICAgICAgICAgICBvYXV0aF9ncmFudF90eXBlOgogICAgICAgICAgICAgICJhdXRob3JpemF0aW9uX2NvZGUiLAogICAgICAgICAgICBtYXJrZXRwbGFjZV9jbGllbnRfaWQ6CiAgICAgICAgICAgICAgZ2V0TWFya2V0cGxhY2VDbGllbnRJZCgpLAogICAgICAgICAgICB0b2tlbl90eXBlOgogICAgICAgICAgICAgIHRva2VuUGF5bG9hZC50b2tlbl90eXBlIHx8CiAgICAgICAgICAgICAgImJlYXJlciIsCiAgICAgICAgICAgIHNjb3BlOgogICAgICAgICAgICAgIHRva2VuUGF5bG9hZC5zY29wZSB8fCBudWxsLAogICAgICAgICAgICBsaXZlX21vZGU6CiAgICAgICAgICAgICAgdG9rZW5QYXlsb2FkLmxpdmVfbW9kZSA/PwogICAgICAgICAgICAgIG51bGwsCiAgICAgICAgICAgIGNvbm5lY3RlZF9hdDoKICAgICAgICAgICAgICBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksCiAgICAgICAgICB9LAogICAgICAgICAgbGFzdF9lcnJvcjogbnVsbCwKICAgICAgICAgIHVwZGF0ZWRfYXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSwKYCwKICAgICJjYWxsYmFjayBvYXV0aCBtZXRhZGF0YSIsCiAgKTsKCn0KCmlmICghY2xpZW50LmluY2x1ZGVzKCJPUkNBTFlfTVBfUkVDT05ORUNUX01FU1NBR0VfVjEiKSkgewogIGNsaWVudCA9IHJlcGxhY2VPbmNlKAogICAgY2xpZW50LAogICAgYCAgICBsYXN0RXJyb3I/OiBzdHJpbmcgfCBudWxsOwogIH07Cn07CmAsCiAgICBgICAgIGxhc3RFcnJvcj86IHN0cmluZyB8IG51bGw7CiAgICBjb25uZWN0aW9uUmVxdWlyZXNSZWNvbm5lY3Q/OiBib29sZWFuOwogIH07Cn07Ci8vIE9SQ0FMWV9NUF9SRUNPTk5FQ1RfTUVTU0FHRV9WMQpgLAogICAgImNsaWVudCB0eXBlIiwKICApOwoKICBjbGllbnQgPSByZXBsYWNlT25jZSgKICAgIGNsaWVudCwKICAgIGAgICAgICAgICAgICA8cCBjbGFzc05hbWU9ImZvbnQtYmxhY2siPlBhZ2FtZW50b3MgYWluZGEgbsOjbyBkaXNwb27DrXZlaXM8L3A+CiAgICAgICAgICAgIDxwIGNsYXNzTmFtZT0ibXQtMiB0ZXh0LXNtIGZvbnQtc2VtaWJvbGQgbGVhZGluZy02Ij4KICAgICAgICAgICAgICBFc3RhIGxvamEgcHJlY2lzYSBjb25lY3RhciB1bWEgY29udGEgTWVyY2FkbyBQYWdvIGFudGVzIGRlIHJlY2ViZXIgcGVkaWRvcyBwZWxvIG1hcmtldHBsYWNlLgogICAgICAgICAgICA8L3A+CmAsCiAgICBgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPSJmb250LWJsYWNrIj4KICAgICAgICAgICAgICB7ZGF0YS5wYXltZW50LmNvbm5lY3Rpb25SZXF1aXJlc1JlY29ubmVjdAogICAgICAgICAgICAgICAgPyAiUmVjb25lY3RlIG8gTWVyY2FkbyBQYWdvIgogICAgICAgICAgICAgICAgOiAiUGFnYW1lbnRvcyBhaW5kYSBuw6NvIGRpc3BvbsOtdmVpcyJ9CiAgICAgICAgICAgIDwvcD4KICAgICAgICAgICAgPHAgY2xhc3NOYW1lPSJtdC0yIHRleHQtc20gZm9udC1zZW1pYm9sZCBsZWFkaW5nLTYiPgogICAgICAgICAgICAgIHtkYXRhLnBheW1lbnQubGFzdEVycm9yIHx8CiAgICAgICAgICAgICAgICAiRXN0YSBsb2phIHByZWNpc2EgY29uZWN0YXIgdW1hIGNvbnRhIE1lcmNhZG8gUGFnbyBhbnRlcyBkZSByZWNlYmVyIHBlZGlkb3MgcGVsbyBtYXJrZXRwbGFjZS4ifQogICAgICAgICAgICA8L3A+CmAsCiAgICAiY2xpZW50IHJlY29ubmVjdCBiYW5uZXIiLAogICk7CgogIGNsaWVudCA9IHJlcGxhY2VPbmNlKAogICAgY2xpZW50LAogICAgYCAgICAgIHNldEVycm9yKAogICAgICAgICJFc3RhIGVtcHJlc2EgYWluZGEgbsOjbyBhdGl2b3Ugb3MgcGFnYW1lbnRvcyBvbmxpbmUuIiwKICAgICAgKTsKYCwKICAgIGAgICAgICBzZXRFcnJvcigKICAgICAgICBkYXRhPy5wYXltZW50Lmxhc3RFcnJvciB8fAogICAgICAgICAgIkVzdGEgZW1wcmVzYSBhaW5kYSBuw6NvIGF0aXZvdSBvcyBwYWdhbWVudG9zIG9ubGluZS4iLAogICAgICApOwpgLAogICAgImNsaWVudCBwYXltZW50IG1lc3NhZ2UiLAogICk7Cgp9Cgp3cml0ZShzZXJ2aWNlUGF0aCwgc2VydmljZSk7CmNvbnNvbGUubG9nKCJQQVRDSF9TRVJWSUNFX1dSSVRURU49MSIpOwoKd3JpdGUoY2FsbGJhY2tQYXRoLCBjYWxsYmFjayk7CmNvbnNvbGUubG9nKCJQQVRDSF9DQUxMQkFDS19XUklUVEVOPTEiKTsKCndyaXRlKGNsaWVudFBhdGgsIGNsaWVudCk7CmNvbnNvbGUubG9nKCJQQVRDSF9DTElFTlRfV1JJVFRFTj0xIik7Cgpjb25zdCBjaGVja3MgPSB7CiAgW3NlcnZpY2VQYXRoXTogWwogICAgIk9SQ0FMWV9NUF9BUFBMSUNBVElPTl9GRUVfT0FVVEhfVjEiLAogICAgInZlcmlmaWVkTWFya2V0cGxhY2VPYXV0aCIsCiAgICAicHJvdmlkZXJDb2RlID09PSAyMDU5IiwKICAgICJjb25uZWN0aW9uUmVxdWlyZXNSZWNvbm5lY3QiLAogIF0sCiAgW2NhbGxiYWNrUGF0aF06IFsKICAgICJPUkNBTFlfTVBfT0FVVEhfUFJPT0ZfVjEiLAogICAgIm9hdXRoX2dyYW50X3R5cGUiLAogICAgIm1hcmtldHBsYWNlX2NsaWVudF9pZCIsCiAgXSwKICBbY2xpZW50UGF0aF06IFsKICAgICJPUkNBTFlfTVBfUkVDT05ORUNUX01FU1NBR0VfVjEiLAogICAgIlJlY29uZWN0ZSBvIE1lcmNhZG8gUGFnbyIsCiAgXSwKfTsKCmZvciAoY29uc3QgW3JlbGF0aXZlLCBtYXJrZXJzXSBvZiBPYmplY3QuZW50cmllcyhjaGVja3MpKSB7CiAgY29uc3Qgc291cmNlID0gcmVhZChyZWxhdGl2ZSk7CgogIGZvciAoY29uc3QgbWFya2VyIG9mIG1hcmtlcnMpIHsKICAgIGlmICghc291cmNlLmluY2x1ZGVzKG1hcmtlcikpIHsKICAgICAgdGhyb3cgbmV3IEVycm9yKAogICAgICAgIGAke3JlbGF0aXZlfTogbWFyY2Fkb3IgYXVzZW50ZTogJHttYXJrZXJ9YCwKICAgICAgKTsKICAgIH0KICB9Cn0KCmNvbnNvbGUubG9nKCJNUF9BUFBMSUNBVElPTl9GRUVfUEFUQ0hFRD0xIik7Cg==
'@

function Write-Section([string]$Text) {
    Write-Host ""
    Write-Host ("=" * 76) -ForegroundColor DarkCyan
    Write-Host $Text -ForegroundColor Cyan
    Write-Host ("=" * 76) -ForegroundColor DarkCyan
}

function Write-Ok([string]$Text) {
    Write-Host "[OK] $Text" -ForegroundColor Green
}

function Write-Warn([string]$Text) {
    Write-Host "[AVISO] $Text" -ForegroundColor Yellow
}

function Resolve-Command(
    [string[]]$Candidates,
    [string]$Name
) {
    foreach ($Candidate in $Candidates) {
        $Resolved = Get-Command `
            $Candidate `
            -ErrorAction SilentlyContinue

        if ($Resolved) {
            return $Resolved.Source
        }
    }

    throw "$Name não foi encontrado."
}

function Invoke-Tool(
    [string]$Command,
    [string[]]$Arguments
) {
    $OldPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $CommandOutput = @()
    $Code = 1

    try {
        $CommandOutput = @(
            & $Command @Arguments 2>&1
        )
        $Code = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $OldPreference
    }

    foreach ($OutputLine in $CommandOutput) {
        Write-Host $OutputLine
    }

    return [int]$Code
}

function Restore-Files {
    if (-not $PatchApplied -or $CommitCreated) {
        return
    }

    Write-Warn "Restaurando os arquivos anteriores..."

    foreach ($Relative in $Files) {
        $Backup = Join-Path `
            $BackupRoot `
            ($Relative -replace "/", "\")

        $Target = Join-Path `
            $Root `
            ($Relative -replace "/", "\")

        if (Test-Path -LiteralPath $Backup) {
            Copy-Item `
                -LiteralPath $Backup `
                -Destination $Target `
                -Force
        }
    }
}

Write-Section "ORCALY - CORREÇÃO APPLICATION_FEE MERCADO PAGO - V7"

if (-not (Test-Path -LiteralPath (Join-Path $Root "package.json"))) {
    throw "Execute este script na raiz do projeto Orçaly."
}

$Git = Resolve-Command @("git.exe", "git") "Git"
$Node = Resolve-Command @("node.exe", "node") "Node.js"
$Npm = Resolve-Command @("npm.cmd", "npm") "npm"
$Cmd = Resolve-Command @("cmd.exe", "cmd") "Prompt de Comando"

if ([string]::IsNullOrWhiteSpace($Branch)) {
    $Branch = (
        & $Git branch --show-current
    ).Trim()
}

if ([string]::IsNullOrWhiteSpace($Branch)) {
    throw "Não foi possível identificar a branch atual."
}

Write-Ok "Branch: $Branch"

foreach ($Relative in $Files) {
    $Target = Join-Path `
        $Root `
        ($Relative -replace "/", "\")

    if (-not (Test-Path -LiteralPath $Target)) {
        throw "Arquivo ausente: $Relative"
    }
}

$ExistingStage = @(
    @(
        & $Git diff --cached --name-only
    ) |
        Where-Object {
            -not [string]::IsNullOrWhiteSpace(
                [string]$_
            )
        }
)

if ($ExistingStage.Count -gt 0) {
    throw "Há arquivos preparados em outro commit. Limpe o stage primeiro."
}

Write-Section "AUDITANDO O PAINEL ADMIN EM UM WORKTREE LIMPO"

$AuditHeadSha = (
    & $Git rev-parse HEAD
).Trim()

if ([string]::IsNullOrWhiteSpace($AuditHeadSha)) {
    throw "Não foi possível identificar o HEAD para a auditoria."
}

$CleanAuditFolder = Join-Path `
    $env:TEMP `
    "orcaly-admin-audit-$Timestamp"

$CleanAuditAdded = $false
$CleanAuditExit = 1
$CleanAuditOutput = @()

try {
    & $Git worktree add `
        --detach `
        $CleanAuditFolder `
        $AuditHeadSha

    if ($LASTEXITCODE -ne 0) {
        throw "Não foi possível criar o worktree da auditoria."
    }

    $CleanAuditAdded = $true
    $CleanAdminCheck = Join-Path `
        $CleanAuditFolder `
        "scripts\admin-security-check.mjs"

    if (-not (Test-Path -LiteralPath $CleanAdminCheck)) {
        throw "O verificador administrativo não existe no commit atual."
    }

    Push-Location $CleanAuditFolder

    try {
        $PreviousPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"

        try {
            $CleanAuditOutput = @(
                & $Node `
                    $CleanAdminCheck `
                    2>&1
            )
            $CleanAuditExit = $LASTEXITCODE
        }
        finally {
            $ErrorActionPreference = $PreviousPreference
        }
    }
    finally {
        Pop-Location
    }
}
finally {
    if ($CleanAuditAdded) {
        & $Git worktree remove `
            --force `
            $CleanAuditFolder

        & $Git worktree prune
    }
}

foreach ($Line in $CleanAuditOutput) {
    Write-Host $Line
}

if ($CleanAuditExit -ne 0) {
    throw "A auditoria administrativa do commit limpo falhou. O detalhe aparece acima."
}

Write-Ok "ADMIN_SECURITY_CHECK_CLEAN_EXIT_CODE=0"

$MarkerByFile = @{
    "lib/payments/checkout-service.ts" =
        "ORCALY_MP_APPLICATION_FEE_OAUTH_V1"
    "app/api/marketplace/payments/mercado-pago/callback/route.ts" =
        "ORCALY_MP_OAUTH_PROOF_V1"
    "components/checkout/CheckoutClient.tsx" =
        "ORCALY_MP_RECONNECT_MESSAGE_V1"
}

$PresentMarkers = @(
    foreach ($Relative in $Files) {
        $Target = Join-Path `
            $Root `
            ($Relative -replace "/", "\")

        $SourceText = Get-Content `
            -LiteralPath $Target `
            -Raw

        if (
            $SourceText.Contains(
                [string]$MarkerByFile[$Relative]
            )
        ) {
            $Relative
        }
    }
)

if (
    $PresentMarkers.Count -gt 0 -and
    $PresentMarkers.Count -lt $Files.Count
) {
    Write-Section "RESTAURANDO O BACKUP DA EXECUÇÃO INTERROMPIDA"

    $BackupParent = Join-Path `
        $Root `
        ".orcaly-backups"

    $BackupCandidates = @(
        Get-ChildItem `
            -LiteralPath $BackupParent `
            -Directory `
            -Filter "mp-application-fee-*" `
            -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending
    )

    $RecoveryBackup = $null

    foreach ($Candidate in $BackupCandidates) {
        $Complete = $true

        foreach ($Relative in $Files) {
            $CandidateFile = Join-Path `
                $Candidate.FullName `
                ($Relative -replace "/", "\")

            if (-not (Test-Path -LiteralPath $CandidateFile)) {
                $Complete = $false
                break
            }
        }

        if ($Complete) {
            $RecoveryBackup = $Candidate
            break
        }
    }

    if ($null -eq $RecoveryBackup) {
        throw "Há um patch parcial, mas nenhum backup completo foi encontrado."
    }

    foreach ($Relative in $Files) {
        $CandidateFile = Join-Path `
            $RecoveryBackup.FullName `
            ($Relative -replace "/", "\")

        $Target = Join-Path `
            $Root `
            ($Relative -replace "/", "\")

        Copy-Item `
            -LiteralPath $CandidateFile `
            -Destination $Target `
            -Force
    }

    Write-Ok "Backup restaurado: $($RecoveryBackup.FullName)"
}

Write-Section "CRIANDO BACKUP LIMPO"

foreach ($Relative in $Files) {
    $SourcePath = Join-Path `
        $Root `
        ($Relative -replace "/", "\")

    $BackupPath = Join-Path `
        $BackupRoot `
        ($Relative -replace "/", "\")

    New-Item `
        -ItemType Directory `
        -Path (Split-Path -Parent $BackupPath) `
        -Force | Out-Null

    Copy-Item `
        -LiteralPath $SourcePath `
        -Destination $BackupPath `
        -Force
}

Write-Ok "Backup: $BackupRoot"

try {
    Write-Section "APLICANDO PATCH"

    $PatcherPath = Join-Path `
        $env:TEMP `
        "orcaly-mp-fee-$Timestamp.mjs"

    [System.IO.File]::WriteAllBytes(
        $PatcherPath,
        [Convert]::FromBase64String(
            ($PatcherBase64 -replace "\s", "")
        )
    )

    try {
        $CheckExit = Invoke-Tool `
            $Node `
            @(
                "--check",
                $PatcherPath
            )

        if ($CheckExit -ne 0) {
            throw "O patcher Node possui erro de sintaxe."
        }

        $PatchApplied = $true
        $PreviousPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"

        try {
            $PatchOutput = @(
                & $Node `
                    $PatcherPath `
                    $Root `
                    2>&1
            )
            $PatchExit = $LASTEXITCODE
        }
        finally {
            $ErrorActionPreference = $PreviousPreference
        }

        foreach ($Line in $PatchOutput) {
            Write-Host $Line
        }

        if ($PatchExit -ne 0) {
            throw "O patch falhou. O detalhe aparece acima."
        }
    }
    finally {
        Remove-Item `
            -LiteralPath $PatcherPath `
            -Force `
            -ErrorAction SilentlyContinue
    }

    Write-Ok "MP_APPLICATION_FEE_PATCHED=1"

    Write-Section "CONFERINDO A PUBLIC KEY DO INTEGRADOR"

    $PublicKeyConfigured = $false

    foreach ($EnvFile in @(
        ".env.local",
        ".env.production.local",
        ".env"
    )) {
        $EnvPath = Join-Path $Root $EnvFile

        if (-not (Test-Path -LiteralPath $EnvPath)) {
            continue
        }

        $EnvSource = Get-Content `
            -LiteralPath $EnvPath `
            -Raw

        if (
            $EnvSource -match
            "(?m)^NEXT_PUBLIC_MP_MARKETPLACE_PUBLIC_KEY=.+$"
        ) {
            $PublicKeyConfigured = $true
            break
        }
    }

    if ($PublicKeyConfigured) {
        Write-Ok "NEXT_PUBLIC_MP_MARKETPLACE_PUBLIC_KEY encontrada localmente"
    }
    else {
        Write-Warn "NEXT_PUBLIC_MP_MARKETPLACE_PUBLIC_KEY não apareceu nos arquivos locais. Confirme essa variável na Vercel antes de testar cartões."
    }

    Write-Section "VALIDANDO CÓDIGO"

    & $Git --no-pager diff --check -- @Files

    if ($LASTEXITCODE -ne 0) {
        throw "git diff --check falhou."
    }

    Write-Section "VALIDANDO O PATCH EM UM WORKTREE LIMPO"

    $ValidationHeadSha = (
        & $Git rev-parse HEAD
    ).Trim()

    if ([string]::IsNullOrWhiteSpace($ValidationHeadSha)) {
        throw "Não foi possível identificar o HEAD para a validação."
    }

    $ValidationFolder = Join-Path `
        $env:TEMP `
        "orcaly-mp-validation-$Timestamp"

    $ValidationAdded = $false
    $ValidationNodeModules = Join-Path `
        $ValidationFolder `
        "node_modules"

    try {
        & $Git worktree add `
            --detach `
            $ValidationFolder `
            $ValidationHeadSha

        if ($LASTEXITCODE -ne 0) {
            throw "Não foi possível criar o worktree de validação."
        }

        $ValidationAdded = $true

        foreach ($Relative in $Files) {
            $SourceFile = Join-Path `
                $Root `
                ($Relative -replace "/", "\")

            $TargetFile = Join-Path `
                $ValidationFolder `
                ($Relative -replace "/", "\")

            New-Item `
                -ItemType Directory `
                -Path (Split-Path -Parent $TargetFile) `
                -Force | Out-Null

            Copy-Item `
                -LiteralPath $SourceFile `
                -Destination $TargetFile `
                -Force
        }

        foreach ($EnvFile in @(
            ".env.local",
            ".env.production.local",
            ".env.development.local"
        )) {
            $SourceEnv = Join-Path $Root $EnvFile

            if (Test-Path -LiteralPath $SourceEnv) {
                Copy-Item `
                    -LiteralPath $SourceEnv `
                    -Destination (
                        Join-Path `
                            $ValidationFolder `
                            $EnvFile
                    ) `
                    -Force
            }
        }

        $ValidationNpmrc = Join-Path `
            $ValidationFolder `
            ".npmrc"

        @(
            "registry=https://registry.npmjs.org/"
            "always-auth=false"
            "audit=false"
            "fund=false"
        ) | Set-Content `
            -LiteralPath $ValidationNpmrc `
            -Encoding Ascii

        Push-Location $ValidationFolder

        try {
            Write-Section "SECURITY CHECK DO COMMIT + PATCH"

            $SecurityScript = Join-Path `
                $ValidationFolder `
                "scripts\security-check.mjs"

            if (-not (Test-Path -LiteralPath $SecurityScript)) {
                throw "scripts/security-check.mjs não foi encontrado no worktree."
            }

            $SecurityExit = Invoke-Tool `
                $Node `
                @(
                    $SecurityScript
                )

            if ($SecurityExit -ne 0) {
                throw "security:check do commit limpo com o patch falhou."
            }

            Write-Ok "SECURITY_CHECK_PATCH_EXIT_CODE=0"

            Write-Section "INSTALANDO DEPENDÊNCIAS NO WORKTREE"

            $PackageLockPath = Join-Path `
                $ValidationFolder `
                "package-lock.json"

            if (-not (Test-Path -LiteralPath $PackageLockPath)) {
                throw "package-lock.json não foi encontrado no commit."
            }

            $InstallExit = Invoke-Tool `
                $Npm `
                @(
                    "ci",
                    "--no-audit",
                    "--no-fund",
                    "--prefer-offline",
                    "--registry=https://registry.npmjs.org/"
                )

            if ($InstallExit -ne 0) {
                throw "npm ci falhou no worktree limpo."
            }

            if (-not (Test-Path -LiteralPath $ValidationNodeModules)) {
                throw "npm ci terminou sem criar node_modules."
            }

            Write-Ok "NPM_CI_PATCH_EXIT_CODE=0"

            Write-Section "BUILD DO COMMIT + PATCH"

            Remove-Item `
                -LiteralPath (
                    Join-Path `
                        $ValidationFolder `
                        ".next"
                ) `
                -Recurse `
                -Force `
                -ErrorAction SilentlyContinue

            $BuildExit = Invoke-Tool `
                $Npm `
                @(
                    "run",
                    "build"
                )

            if ($BuildExit -ne 0) {
                throw "O build do commit limpo com o patch falhou."
            }

            Write-Ok "BUILD_PATCH_EXIT_CODE=0"
        }
        finally {
            Pop-Location
        }
    }
    finally {
        if (Test-Path -LiteralPath $ValidationNodeModules) {
            $RemoveNodeModulesCommand = (
                'rmdir /s /q "{0}"' -f
                $ValidationNodeModules.Replace(
                    '"',
                    '""'
                )
            )

            & $Cmd `
                /d `
                /c `
                $RemoveNodeModulesCommand `
                | Out-Null

            if (Test-Path -LiteralPath $ValidationNodeModules) {
                Write-Warn "Não foi possível apagar node_modules temporário: $ValidationNodeModules"
            }
            else {
                Write-Ok "TEMP_NODE_MODULES_REMOVED=1"
            }
        }

        if ($ValidationAdded) {
            & $Git worktree remove `
                --force `
                $ValidationFolder

            if ($LASTEXITCODE -ne 0) {
                Write-Warn "O Git não removeu o worktree automaticamente: $ValidationFolder"
            }

            & $Git worktree prune
        }
    }

    Write-Section "CRIANDO COMMIT"

    foreach ($Relative in $Files) {
        & $Git add -- $Relative

        if ($LASTEXITCODE -ne 0) {
            throw "Não foi possível preparar: $Relative"
        }
    }

    $Prepared = @(
        @(
            & $Git diff --cached --name-only
        ) |
            Where-Object {
                -not [string]::IsNullOrWhiteSpace(
                    [string]$_
                )
            }
    )

    $Unexpected = @(
        @($Prepared) |
            Where-Object {
                $Files -notcontains [string]$_
            }
    )

    if ($Unexpected.Count -gt 0) {
        throw "O stage contém arquivos fora do escopo."
    }

    if ($Prepared.Count -gt 0) {
        & $Git commit -m $CommitMessage

        if ($LASTEXITCODE -ne 0) {
            throw "Não foi possível criar o commit."
        }

        $CommitCreated = $true
        Write-Ok "COMMIT_CRIADO=1"
    }
    else {
        Write-Warn "Nenhuma alteração nova para commit."
    }

    Write-Section "ENVIANDO AO GITHUB"

    & $Git push -u origin $Branch

    if ($LASTEXITCODE -ne 0) {
        throw "O push falhou."
    }

    Write-Ok "PUSH_CONCLUIDO=1"

    Write-Section "PUBLICANDO UM WORKTREE LIMPO NA VERCEL"

    $HeadSha = (
        & $Git rev-parse HEAD
    ).Trim()

    $ShortSha = (
        & $Git rev-parse --short HEAD
    ).Trim()

    if (
        [string]::IsNullOrWhiteSpace($HeadSha) -or
        [string]::IsNullOrWhiteSpace($ShortSha)
    ) {
        throw "Não foi possível identificar o commit de deploy."
    }

    $Vercel = Get-Command `
        vercel.cmd `
        -ErrorAction SilentlyContinue

    if (-not $Vercel) {
        $Vercel = Get-Command `
            vercel `
            -ErrorAction SilentlyContinue
    }

    $VercelCommand = ""
    $VercelPrefix = @()

    if ($Vercel) {
        $VercelCommand = $Vercel.Source
    }
    else {
        $Npx = Resolve-Command @("npx.cmd", "npx") "npx"
        $VercelCommand = $Npx
        $VercelPrefix = @(
            "--yes",
            "vercel@latest"
        )
    }

    $VercelFolder = Join-Path $Root ".vercel"

    if (-not (Test-Path -LiteralPath $VercelFolder)) {
        throw "A pasta .vercel não foi encontrada. Execute vercel link antes."
    }

    $DeployFolder = Join-Path `
        $env:TEMP `
        "orcaly-mp-fee-$ShortSha-$Timestamp"

    $WorktreeAdded = $false
    $DeployExit = 1

    try {
        & $Git worktree add --detach $DeployFolder $HeadSha

        if ($LASTEXITCODE -ne 0) {
            throw "Não foi possível criar o worktree de deploy."
        }

        $WorktreeAdded = $true

        Copy-Item `
            -LiteralPath $VercelFolder `
            -Destination (Join-Path $DeployFolder ".vercel") `
            -Recurse `
            -Force

        Push-Location $DeployFolder

        try {
            $DeployArguments = @()

            if ($VercelPrefix.Count -gt 0) {
                $DeployArguments += $VercelPrefix
            }

            $DeployArguments += @(
                "--prod",
                "--yes",
                "--force"
            )

            & $VercelCommand @DeployArguments
            $DeployExit = $LASTEXITCODE
        }
        finally {
            Pop-Location
        }
    }
    finally {
        if ($WorktreeAdded) {
            & $Git worktree remove --force $DeployFolder
            & $Git worktree prune
        }
    }

    if ($DeployExit -ne 0) {
        Write-Warn "A Vercel retornou código $DeployExit. Confira o deployment antes de repetir, pois a CLI já apresentou falso negativo."
    }
    else {
        Write-Ok "DEPLOY_SOLICITADO=1"
    }

    Write-Section "RECONEXÃO OBRIGATÓRIA"

    Write-Host "Depois que o deployment ficar READY:"
    Write-Host "1. Abra https://orcaly.com.br/painel/pagamentos?tab=mercado-pago"
    Write-Host "2. Desconecte a conta Mercado Pago atual."
    Write-Host "3. Conecte novamente e autorize a conta vendedora."
    Write-Host ""
    Write-Host "No Mercado Pago, a aplicação precisa ser:"
    Write-Host "Pagamentos online > Marketplace > Checkout API"
    Write-Host ""
    Write-Host "Redirect URL:"
    Write-Host "https://orcaly.com.br/api/marketplace/payments/mercado-pago/callback"
    Write-Host ""
    Write-Host "A application_fee foi preservada."
    Write-Host "Auditoria administrativa: executada no commit limpo"
    Write-Host "Security check: Node direto no commit limpo + patch"
    Write-Host "Dependências: npm ci dentro do worktree"
    Write-Host "Build: commit limpo + patch, sem junction ou symlink"
    Write-Host "Arquivos locais não relacionados: fora do commit e do deploy"
}
catch {
    Restore-Files
    throw
}
