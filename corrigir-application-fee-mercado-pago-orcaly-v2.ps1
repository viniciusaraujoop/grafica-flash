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
$InstallerVersion = "V2_STRICTMODE_ARRAY_FIX"
$PatchApplied = $false
$CommitCreated = $false

$PatcherBase64 = @'
aW1wb3J0IGZzIGZyb20gIm5vZGU6ZnMiOwppbXBvcnQgcGF0aCBmcm9tICJub2RlOnBhdGgiOwoKY29uc3Qgcm9vdCA9IHByb2Nlc3MuYXJndlsyXTsKaWYgKCFyb290KSB0aHJvdyBuZXcgRXJyb3IoIlJhaXogZG8gcHJvamV0byBuw6NvIGluZm9ybWFkYS4iKTsKCmZ1bmN0aW9uIGZpbGUocmVsYXRpdmUpIHsKICByZXR1cm4gcGF0aC5qb2luKHJvb3QsIHJlbGF0aXZlKTsKfQoKZnVuY3Rpb24gcmVhZChyZWxhdGl2ZSkgewogIHJldHVybiBmcwogICAgLnJlYWRGaWxlU3luYyhmaWxlKHJlbGF0aXZlKSwgInV0ZjgiKQogICAgLnJlcGxhY2UoL1xyXG4vZywgIlxuIikKICAgIC5yZXBsYWNlKC9cci9nLCAiXG4iKTsKfQoKZnVuY3Rpb24gd3JpdGUocmVsYXRpdmUsIGNvbnRlbnQpIHsKICBmcy53cml0ZUZpbGVTeW5jKGZpbGUocmVsYXRpdmUpLCBjb250ZW50LCAidXRmOCIpOwp9CgpmdW5jdGlvbiByZXBsYWNlT25jZShzb3VyY2UsIGJlZm9yZSwgYWZ0ZXIsIGxhYmVsKSB7CiAgY29uc3QgaW5kZXggPSBzb3VyY2UuaW5kZXhPZihiZWZvcmUpOwogIGlmIChpbmRleCA8IDApIHsKICAgIHRocm93IG5ldyBFcnJvcihgVHJlY2hvIG7Do28gZW5jb250cmFkbzogJHtsYWJlbH1gKTsKICB9CiAgaWYgKHNvdXJjZS5pbmRleE9mKGJlZm9yZSwgaW5kZXggKyBiZWZvcmUubGVuZ3RoKSA+PSAwKSB7CiAgICB0aHJvdyBuZXcgRXJyb3IoYFRyZWNobyBhbWLDrWd1bzogJHtsYWJlbH1gKTsKICB9CiAgcmV0dXJuICgKICAgIHNvdXJjZS5zbGljZSgwLCBpbmRleCkgKwogICAgYWZ0ZXIgKwogICAgc291cmNlLnNsaWNlKGluZGV4ICsgYmVmb3JlLmxlbmd0aCkKICApOwp9Cgpjb25zdCBzZXJ2aWNlUGF0aCA9ICJsaWIvcGF5bWVudHMvY2hlY2tvdXQtc2VydmljZS50cyI7CmNvbnN0IGNhbGxiYWNrUGF0aCA9CiAgImFwcC9hcGkvbWFya2V0cGxhY2UvcGF5bWVudHMvbWVyY2Fkby1wYWdvL2NhbGxiYWNrL3JvdXRlLnRzIjsKY29uc3QgY2xpZW50UGF0aCA9ICJjb21wb25lbnRzL2NoZWNrb3V0L0NoZWNrb3V0Q2xpZW50LnRzeCI7CgpsZXQgc2VydmljZSA9IHJlYWQoc2VydmljZVBhdGgpOwpsZXQgY2FsbGJhY2sgPSByZWFkKGNhbGxiYWNrUGF0aCk7CmxldCBjbGllbnQgPSByZWFkKGNsaWVudFBhdGgpOwoKaWYgKCFzZXJ2aWNlLmluY2x1ZGVzKCJPUkNBTFlfTVBfQVBQTElDQVRJT05fRkVFX09BVVRIX1YxIikpIHsKICBzZXJ2aWNlID0gcmVwbGFjZU9uY2UoCiAgICBzZXJ2aWNlLAogICAgJ2ltcG9ydCB7IGdldFBsYW5Db25maWcgfSBmcm9tICJAL2xpYi9wbGFucy9wbGFuLWNvbmZpZyI7JywKICAgIGBpbXBvcnQgeyBnZXRQbGFuQ29uZmlnIH0gZnJvbSAiQC9saWIvcGxhbnMvcGxhbi1jb25maWciOwppbXBvcnQgewogIGdldE1hcmtldHBsYWNlQ2xpZW50SWQsCn0gZnJvbSAiQC9saWIvcGF5bWVudHMvbWFya2V0cGxhY2UvY29uZmlnIjsKLy8gT1JDQUxZX01QX0FQUExJQ0FUSU9OX0ZFRV9PQVVUSF9WMWAsCiAgICAiaW1wb3J0IG1hcmtldHBsYWNlIGNvbmZpZyIsCiAgKTsKCiAgc2VydmljZSA9IHJlcGxhY2VPbmNlKAogICAgc2VydmljZSwKICAgIGBmdW5jdGlvbiBhc1JlY29yZCh2YWx1ZTogdW5rbm93bik6IEpzb25SZWNvcmQgewogIGlmICghdmFsdWUgfHwgdHlwZW9mIHZhbHVlICE9PSAib2JqZWN0IiB8fCBBcnJheS5pc0FycmF5KHZhbHVlKSkgewogICAgcmV0dXJuIHt9OwogIH0KCiAgcmV0dXJuIHZhbHVlIGFzIEpzb25SZWNvcmQ7Cn0KYCwKICAgIGBmdW5jdGlvbiBhc1JlY29yZCh2YWx1ZTogdW5rbm93bik6IEpzb25SZWNvcmQgewogIGlmICghdmFsdWUgfHwgdHlwZW9mIHZhbHVlICE9PSAib2JqZWN0IiB8fCBBcnJheS5pc0FycmF5KHZhbHVlKSkgewogICAgcmV0dXJuIHt9OwogIH0KCiAgcmV0dXJuIHZhbHVlIGFzIEpzb25SZWNvcmQ7Cn0KCmZ1bmN0aW9uIG1hcmtldHBsYWNlUHVibGljS2V5KCkgewogIHJldHVybiB0ZXh0KAogICAgcHJvY2Vzcy5lbnYuTkVYVF9QVUJMSUNfTVBfTUFSS0VUUExBQ0VfUFVCTElDX0tFWSwKICApOwp9CgpmdW5jdGlvbiB2ZXJpZmllZE1hcmtldHBsYWNlT2F1dGgodmFsdWU6IHVua25vd24pIHsKICBjb25zdCBtZXRhZGF0YSA9IGFzUmVjb3JkKHZhbHVlKTsKICBjb25zdCBjb25maWd1cmVkQ2xpZW50SWQgPSB0ZXh0KAogICAgcHJvY2Vzcy5lbnYuTVBfTUFSS0VUUExBQ0VfQ0xJRU5UX0lELAogICk7CgogIHJldHVybiBCb29sZWFuKAogICAgY29uZmlndXJlZENsaWVudElkICYmCiAgICAgIG1ldGFkYXRhLm9hdXRoX2dyYW50X3R5cGUgPT09ICJhdXRob3JpemF0aW9uX2NvZGUiICYmCiAgICAgIHRleHQobWV0YWRhdGEubWFya2V0cGxhY2VfY2xpZW50X2lkKSA9PT0KICAgICAgICBjb25maWd1cmVkQ2xpZW50SWQsCiAgKTsKfQoKZnVuY3Rpb24gbWVyY2Fkb1BhZ29Qcm92aWRlckVycm9yQ29kZShjYXVzZTogdW5rbm93bikgewogIGlmICghY2F1c2UgfHwgdHlwZW9mIGNhdXNlICE9PSAib2JqZWN0IikgcmV0dXJuIDA7CgogIGNvbnN0IHByb3ZpZGVyUGF5bG9hZCA9CiAgICAicHJvdmlkZXJQYXlsb2FkIiBpbiBjYXVzZQogICAgICA/IGFzUmVjb3JkKAogICAgICAgICAgKAogICAgICAgICAgICBjYXVzZSBhcyB7CiAgICAgICAgICAgICAgcHJvdmlkZXJQYXlsb2FkPzogdW5rbm93bjsKICAgICAgICAgICAgfQogICAgICAgICAgKS5wcm92aWRlclBheWxvYWQsCiAgICAgICAgKQogICAgICA6IHt9OwogIGNvbnN0IGRpcmVjdENvZGUgPSBOdW1iZXIoCiAgICBwcm92aWRlclBheWxvYWQuY29kZSB8fAogICAgICBwcm92aWRlclBheWxvYWQuc3RhdHVzIHx8CiAgICAgIDAsCiAgKTsKCiAgaWYgKGRpcmVjdENvZGUpIHJldHVybiBkaXJlY3RDb2RlOwoKICBmb3IgKGNvbnN0IHJhd0NhdXNlIG9mIGFycmF5KHByb3ZpZGVyUGF5bG9hZC5jYXVzZSkpIHsKICAgIGNvbnN0IHJlY29yZCA9IGFzUmVjb3JkKHJhd0NhdXNlKTsKICAgIGNvbnN0IGNvZGUgPSBOdW1iZXIoCiAgICAgIHJlY29yZC5jb2RlIHx8CiAgICAgICAgcmVjb3JkLnN0YXR1cyB8fAogICAgICAgIDAsCiAgICApOwoKICAgIGlmIChjb2RlKSByZXR1cm4gY29kZTsKICB9CgogIHJldHVybiAwOwp9CmAsCiAgICAib2F1dGggaGVscGVycyIsCiAgKTsKCiAgc2VydmljZSA9IHJlcGxhY2VPbmNlKAogICAgc2VydmljZSwKICAgIGAiaWQsYWNjZXNzX3Rva2VuLHJlZnJlc2hfdG9rZW4scHVibGljX2tleSx0b2tlbl9leHBpcmVzX2F0LG9uYm9hcmRpbmdfc3RhdHVzLGlzX2FjdGl2ZSxsYXN0X2Vycm9yIixgLAogICAgYCJpZCxhY2Nlc3NfdG9rZW4scmVmcmVzaF90b2tlbixwdWJsaWNfa2V5LHRva2VuX2V4cGlyZXNfYXQsb25ib2FyZGluZ19zdGF0dXMsaXNfYWN0aXZlLGxhc3RfZXJyb3IscHJvdmlkZXJfbWV0YWRhdGFfc2FuaXRpemVkIixgLAogICAgInNlbGxlciB0b2tlbiBzZWxlY3QiLAogICk7CgogIHNlcnZpY2UgPSByZXBsYWNlT25jZSgKICAgIHNlcnZpY2UsCiAgICBgICBsZXQgYWNjZXNzVG9rZW4gPQogICAgdW5wcm90ZWN0TWVyY2Fkb1BhZ29Ub2tlbigKICAgICAgc2V0dGluZy5hY2Nlc3NfdG9rZW4sCiAgICApOwpgLAogICAgYCAgaWYgKAogICAgIXZlcmlmaWVkTWFya2V0cGxhY2VPYXV0aCgKICAgICAgc2V0dGluZy5wcm92aWRlcl9tZXRhZGF0YV9zYW5pdGl6ZWQsCiAgICApCiAgKSB7CiAgICB0aHJvdyBPYmplY3QuYXNzaWduKAogICAgICBuZXcgRXJyb3IoCiAgICAgICAgIlJlY29uZWN0ZSBhIGNvbnRhIE1lcmNhZG8gUGFnbyBwZWxvIHBhaW5lbC4gQSBjb25leMOjbyBhdHVhbCBuw6NvIGZvaSB2YWxpZGFkYSBjb21vIE9BdXRoIE1hcmtldHBsYWNlLiIsCiAgICAgICksCiAgICAgIHsgc3RhdHVzOiA0MDkgfSwKICAgICk7CiAgfQoKICBsZXQgYWNjZXNzVG9rZW4gPQogICAgdW5wcm90ZWN0TWVyY2Fkb1BhZ29Ub2tlbigKICAgICAgc2V0dGluZy5hY2Nlc3NfdG9rZW4sCiAgICApOwpgLAogICAgImxlZ2FjeSB0b2tlbiBndWFyZCIsCiAgKTsKCiAgc2VydmljZSA9IHJlcGxhY2VPbmNlKAogICAgc2VydmljZSwKICAgIGAiYWNjZXNzX3Rva2VuLHB1YmxpY19rZXksb25ib2FyZGluZ19zdGF0dXMsYWNjb3VudF9zdGF0dXMsaXNfYWN0aXZlLGNoYXJnZXNfZW5hYmxlZCxwaXhfZW5hYmxlZCxjYXJkX2VuYWJsZWQsbGFzdF9lcnJvciIsYCwKICAgIGAiYWNjZXNzX3Rva2VuLHB1YmxpY19rZXksb25ib2FyZGluZ19zdGF0dXMsYWNjb3VudF9zdGF0dXMsaXNfYWN0aXZlLGNoYXJnZXNfZW5hYmxlZCxwaXhfZW5hYmxlZCxjYXJkX2VuYWJsZWQsbGFzdF9lcnJvcixwcm92aWRlcl9tZXRhZGF0YV9zYW5pdGl6ZWQiLGAsCiAgICAiY2F0YWxvZyBwYXltZW50IHNlbGVjdCIsCiAgKTsKCiAgc2VydmljZSA9IHJlcGxhY2VPbmNlKAogICAgc2VydmljZSwKICAgIGAgIGNvbnN0IHB1YmxpY0tleSA9IHRleHQoCiAgICBhY2NvdW50Py5wdWJsaWNfa2V5LAogICk7CgogIGNvbnN0IGNvbm5lY3RlZCA9IEJvb2xlYW4oCiAgICBhY2NvdW50Py5pc19hY3RpdmUgJiYKICAgICAgYWNjb3VudD8uYWNjZXNzX3Rva2VuICYmCiAgICAgIHB1YmxpY0tleSAmJgogICAgICBhY2NvdW50Py5vbmJvYXJkaW5nX3N0YXR1cyA9PT0KICAgICAgICAiY29ubmVjdGVkIiwKICApOwpgLAogICAgYCAgY29uc3QgcHVibGljS2V5ID0KICAgIG1hcmtldHBsYWNlUHVibGljS2V5KCk7CiAgY29uc3Qgb2F1dGhWZXJpZmllZCA9CiAgICB2ZXJpZmllZE1hcmtldHBsYWNlT2F1dGgoCiAgICAgIGFjY291bnQ/LnByb3ZpZGVyX21ldGFkYXRhX3Nhbml0aXplZCwKICAgICk7CiAgY29uc3QgY29ubmVjdGlvblJlcXVpcmVzUmVjb25uZWN0ID0KICAgIEJvb2xlYW4oCiAgICAgIGFjY291bnQ/LmFjY2Vzc190b2tlbiAmJgogICAgICAgICFvYXV0aFZlcmlmaWVkLAogICAgKTsKCiAgY29uc3QgY29ubmVjdGVkID0gQm9vbGVhbigKICAgIGFjY291bnQ/LmlzX2FjdGl2ZSAmJgogICAgICBhY2NvdW50Py5hY2Nlc3NfdG9rZW4gJiYKICAgICAgcHVibGljS2V5ICYmCiAgICAgIG9hdXRoVmVyaWZpZWQgJiYKICAgICAgYWNjb3VudD8ub25ib2FyZGluZ19zdGF0dXMgPT09CiAgICAgICAgImNvbm5lY3RlZCIsCiAgKTsKYCwKICAgICJpbnRlZ3JhdG9yIHB1YmxpYyBrZXkiLAogICk7CgogIHNlcnZpY2UgPSByZXBsYWNlT25jZSgKICAgIHNlcnZpY2UsCiAgICBgICAgICAgbGFzdEVycm9yOgogICAgICAgIGFjY291bnQ/Lmxhc3RfZXJyb3IgfHwgbnVsbCwKYCwKICAgIGAgICAgICBsYXN0RXJyb3I6CiAgICAgICAgY29ubmVjdGlvblJlcXVpcmVzUmVjb25uZWN0CiAgICAgICAgICA/ICJSZWNvbmVjdGUgYSBjb250YSBNZXJjYWRvIFBhZ28gcGFyYSBhdGl2YXIgbyBzcGxpdCBkZSBwYWdhbWVudG9zLiIKICAgICAgICAgIDogIXB1YmxpY0tleQogICAgICAgICAgICA/ICJBIGNoYXZlIHDDumJsaWNhIGRvIGludGVncmFkb3IgTWVyY2FkbyBQYWdvIG7Do28gZXN0w6EgY29uZmlndXJhZGEuIgogICAgICAgICAgICA6IGFjY291bnQ/Lmxhc3RfZXJyb3IgfHwgbnVsbCwKICAgICAgY29ubmVjdGlvblJlcXVpcmVzUmVjb25uZWN0LApgLAogICAgImNhdGFsb2cgcmVjb25uZWN0IGluZm8iLAogICk7CgogIHNlcnZpY2UgPSByZXBsYWNlT25jZSgKICAgIHNlcnZpY2UsCiAgICBgICAgIHRocm93IGNhdXNlOwogIH0KfQpgLAogICAgYCAgICBjb25zdCBwcm92aWRlckNvZGUgPQogICAgICBtZXJjYWRvUGFnb1Byb3ZpZGVyRXJyb3JDb2RlKAogICAgICAgIGNhdXNlLAogICAgICApOwogICAgY29uc3QgYXBwbGljYXRpb25GZWVPYXV0aFJlamVjdGVkID0KICAgICAgcHJvdmlkZXJDb2RlID09PSAyMDU5IHx8CiAgICAgIG1lc3NhZ2UKICAgICAgICAudG9Mb3dlckNhc2UoKQogICAgICAgIC5pbmNsdWRlcygiYXBwbGljYXRpb25fZmVlIik7CgogICAgaWYgKGFwcGxpY2F0aW9uRmVlT2F1dGhSZWplY3RlZCkgewogICAgICBjb25zdCByZWNvbm5lY3RNZXNzYWdlID0KICAgICAgICAiQSBjb250YSBNZXJjYWRvIFBhZ28gcHJlY2lzYSBzZXIgcmVjb25lY3RhZGEgcG9yIE9BdXRoIHVzYW5kbyB1bWEgYXBsaWNhw6fDo28gY29uZmlndXJhZGEgY29tbyBNYXJrZXRwbGFjZS4iOwoKICAgICAgYXdhaXQgc3VwYWJhc2UKICAgICAgICAuZnJvbSgKICAgICAgICAgICJtYXJrZXRwbGFjZV9wYXltZW50X3NldHRpbmdzIiwKICAgICAgICApCiAgICAgICAgLnVwZGF0ZSh7CiAgICAgICAgICBvbmJvYXJkaW5nX3N0YXR1czoKICAgICAgICAgICAgInJlY29ubmVjdF9yZXF1aXJlZCIsCiAgICAgICAgICBjaGFyZ2VzX2VuYWJsZWQ6IGZhbHNlLAogICAgICAgICAgbGFzdF9lcnJvcjoKICAgICAgICAgICAgcmVjb25uZWN0TWVzc2FnZSwKICAgICAgICAgIHVwZGF0ZWRfYXQ6CiAgICAgICAgICAgIG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSwKICAgICAgICB9KQogICAgICAgIC5lcSgiY29tcGFueV9pZCIsIGNvbXBhbnlJZCkKICAgICAgICAuZXEoInByb3ZpZGVyIiwgIm1lcmNhZG9fcGFnbyIpOwoKICAgICAgdGhyb3cgT2JqZWN0LmFzc2lnbigKICAgICAgICBuZXcgRXJyb3IocmVjb25uZWN0TWVzc2FnZSksCiAgICAgICAgeyBzdGF0dXM6IDQwOSB9LAogICAgICApOwogICAgfQoKICAgIHRocm93IGNhdXNlOwogIH0KfQpgLAogICAgIjIwNTkgaGFuZGxlciIsCiAgKTsKCiAgd3JpdGUoc2VydmljZVBhdGgsIHNlcnZpY2UpOwp9CgppZiAoIWNhbGxiYWNrLmluY2x1ZGVzKCJPUkNBTFlfTVBfT0FVVEhfUFJPT0ZfVjEiKSkgewogIGNhbGxiYWNrID0gcmVwbGFjZU9uY2UoCiAgICBjYWxsYmFjaywKICAgIGBpbXBvcnQgewogIGV4Y2hhbmdlTWVyY2Fkb1BhZ29Db2RlLAogIGhhc2hPYXV0aFN0YXRlLAogIHByb3RlY3RNZXJjYWRvUGFnb1Rva2VuLAogIHZlcmlmeU1lcmNhZG9QYWdvT2F1dGhTdGF0ZUFuZEdldFZlcmlmaWVyLAp9IGZyb20gIkAvbGliL21lcmNhZG8tcGFnbyI7CmAsCiAgICBgaW1wb3J0IHsKICBleGNoYW5nZU1lcmNhZG9QYWdvQ29kZSwKICBoYXNoT2F1dGhTdGF0ZSwKICBwcm90ZWN0TWVyY2Fkb1BhZ29Ub2tlbiwKICB2ZXJpZnlNZXJjYWRvUGFnb09hdXRoU3RhdGVBbmRHZXRWZXJpZmllciwKfSBmcm9tICJAL2xpYi9tZXJjYWRvLXBhZ28iOwppbXBvcnQgewogIGdldE1hcmtldHBsYWNlQ2xpZW50SWQsCn0gZnJvbSAiQC9saWIvcGF5bWVudHMvbWFya2V0cGxhY2UvY29uZmlnIjsKLy8gT1JDQUxZX01QX09BVVRIX1BST09GX1YxCmAsCiAgICAiY2FsbGJhY2sgaW1wb3J0IiwKICApOwoKICBjYWxsYmFjayA9IHJlcGxhY2VPbmNlKAogICAgY2FsbGJhY2ssCiAgICBgICAgICAgICAgIGxhc3Rfc3RhdHVzX2NoZWNrX2F0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksCiAgICAgICAgICBsYXN0X2Vycm9yOiBudWxsLAogICAgICAgICAgdXBkYXRlZF9hdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLApgLAogICAgYCAgICAgICAgICBsYXN0X3N0YXR1c19jaGVja19hdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLAogICAgICAgICAgcHJvdmlkZXJfbWV0YWRhdGFfc2FuaXRpemVkOiB7CiAgICAgICAgICAgIG9hdXRoX2dyYW50X3R5cGU6CiAgICAgICAgICAgICAgImF1dGhvcml6YXRpb25fY29kZSIsCiAgICAgICAgICAgIG1hcmtldHBsYWNlX2NsaWVudF9pZDoKICAgICAgICAgICAgICBnZXRNYXJrZXRwbGFjZUNsaWVudElkKCksCiAgICAgICAgICAgIHRva2VuX3R5cGU6CiAgICAgICAgICAgICAgdG9rZW5QYXlsb2FkLnRva2VuX3R5cGUgfHwKICAgICAgICAgICAgICAiYmVhcmVyIiwKICAgICAgICAgICAgc2NvcGU6CiAgICAgICAgICAgICAgdG9rZW5QYXlsb2FkLnNjb3BlIHx8IG51bGwsCiAgICAgICAgICAgIGxpdmVfbW9kZToKICAgICAgICAgICAgICB0b2tlblBheWxvYWQubGl2ZV9tb2RlID8/CiAgICAgICAgICAgICAgbnVsbCwKICAgICAgICAgICAgY29ubmVjdGVkX2F0OgogICAgICAgICAgICAgIG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSwKICAgICAgICAgIH0sCiAgICAgICAgICBsYXN0X2Vycm9yOiBudWxsLAogICAgICAgICAgdXBkYXRlZF9hdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLApgLAogICAgImNhbGxiYWNrIG9hdXRoIG1ldGFkYXRhIiwKICApOwoKICB3cml0ZShjYWxsYmFja1BhdGgsIGNhbGxiYWNrKTsKfQoKaWYgKCFjbGllbnQuaW5jbHVkZXMoIk9SQ0FMWV9NUF9SRUNPTk5FQ1RfTUVTU0FHRV9WMSIpKSB7CiAgY2xpZW50ID0gcmVwbGFjZU9uY2UoCiAgICBjbGllbnQsCiAgICBgICAgIGxhc3RFcnJvcj86IHN0cmluZyB8IG51bGw7CiAgfTsKfTsKYCwKICAgIGAgICAgbGFzdEVycm9yPzogc3RyaW5nIHwgbnVsbDsKICAgIGNvbm5lY3Rpb25SZXF1aXJlc1JlY29ubmVjdD86IGJvb2xlYW47CiAgfTsKfTsKLy8gT1JDQUxZX01QX1JFQ09OTkVDVF9NRVNTQUdFX1YxCmAsCiAgICAiY2xpZW50IHR5cGUiLAogICk7CgogIGNsaWVudCA9IHJlcGxhY2VPbmNlKAogICAgY2xpZW50LAogICAgYCAgICAgICAgICAgIDxwIGNsYXNzTmFtZT0iZm9udC1ibGFjayI+UGFnYW1lbnRvcyBhaW5kYSBuw6NvIGRpc3BvbsOtdmVpczwvcD4KICAgICAgICAgICAgPHAgY2xhc3NOYW1lPSJtdC0yIHRleHQtc20gZm9udC1zZW1pYm9sZCBsZWFkaW5nLTYiPgogICAgICAgICAgICAgIEVzdGEgbG9qYSBwcmVjaXNhIGNvbmVjdGFyIHVtYSBjb250YSBNZXJjYWRvIFBhZ28gYW50ZXMgZGUgcmVjZWJlciBwZWRpZG9zIHBlbG8gbWFya2V0cGxhY2UuCiAgICAgICAgICAgIDwvcD4KYCwKICAgIGAgICAgICAgICAgICA8cCBjbGFzc05hbWU9ImZvbnQtYmxhY2siPgogICAgICAgICAgICAgIHtkYXRhLnBheW1lbnQuY29ubmVjdGlvblJlcXVpcmVzUmVjb25uZWN0CiAgICAgICAgICAgICAgICA/ICJSZWNvbmVjdGUgbyBNZXJjYWRvIFBhZ28iCiAgICAgICAgICAgICAgICA6ICJQYWdhbWVudG9zIGFpbmRhIG7Do28gZGlzcG9uw612ZWlzIn0KICAgICAgICAgICAgPC9wPgogICAgICAgICAgICA8cCBjbGFzc05hbWU9Im10LTIgdGV4dC1zbSBmb250LXNlbWlib2xkIGxlYWRpbmctNiI+CiAgICAgICAgICAgICAge2RhdGEucGF5bWVudC5sYXN0RXJyb3IgfHwKICAgICAgICAgICAgICAgICJFc3RhIGxvamEgcHJlY2lzYSBjb25lY3RhciB1bWEgY29udGEgTWVyY2FkbyBQYWdvIGFudGVzIGRlIHJlY2ViZXIgcGVkaWRvcyBwZWxvIG1hcmtldHBsYWNlLiJ9CiAgICAgICAgICAgIDwvcD4KYCwKICAgICJjbGllbnQgcmVjb25uZWN0IGJhbm5lciIsCiAgKTsKCiAgY2xpZW50ID0gcmVwbGFjZU9uY2UoCiAgICBjbGllbnQsCiAgICBgICAgICAgICAgICAgICAgICAgICAgIEVzdGEgZW1wcmVzYSBhaW5kYSBuw6NvIGF0aXZvdSBvcyBwYWdhbWVudG9zIG9ubGluZS4KYCwKICAgIGAgICAgICAgICAgICAgICAgICAgICAge2RhdGEucGF5bWVudC5sYXN0RXJyb3IgfHwKICAgICAgICAgICAgICAgICAgICAgICAgIkVzdGEgZW1wcmVzYSBhaW5kYSBuw6NvIGF0aXZvdSBvcyBwYWdhbWVudG9zIG9ubGluZS4ifQpgLAogICAgImNsaWVudCBwYXltZW50IG1lc3NhZ2UiLAogICk7CgogIHdyaXRlKGNsaWVudFBhdGgsIGNsaWVudCk7Cn0KCmNvbnN0IGNoZWNrcyA9IHsKICBbc2VydmljZVBhdGhdOiBbCiAgICAiT1JDQUxZX01QX0FQUExJQ0FUSU9OX0ZFRV9PQVVUSF9WMSIsCiAgICAidmVyaWZpZWRNYXJrZXRwbGFjZU9hdXRoIiwKICAgICJwcm92aWRlckNvZGUgPT09IDIwNTkiLAogICAgImNvbm5lY3Rpb25SZXF1aXJlc1JlY29ubmVjdCIsCiAgXSwKICBbY2FsbGJhY2tQYXRoXTogWwogICAgIk9SQ0FMWV9NUF9PQVVUSF9QUk9PRl9WMSIsCiAgICAib2F1dGhfZ3JhbnRfdHlwZSIsCiAgICAibWFya2V0cGxhY2VfY2xpZW50X2lkIiwKICBdLAogIFtjbGllbnRQYXRoXTogWwogICAgIk9SQ0FMWV9NUF9SRUNPTk5FQ1RfTUVTU0FHRV9WMSIsCiAgICAiUmVjb25lY3RlIG8gTWVyY2FkbyBQYWdvIiwKICBdLAp9OwoKZm9yIChjb25zdCBbcmVsYXRpdmUsIG1hcmtlcnNdIG9mIE9iamVjdC5lbnRyaWVzKGNoZWNrcykpIHsKICBjb25zdCBzb3VyY2UgPSByZWFkKHJlbGF0aXZlKTsKCiAgZm9yIChjb25zdCBtYXJrZXIgb2YgbWFya2VycykgewogICAgaWYgKCFzb3VyY2UuaW5jbHVkZXMobWFya2VyKSkgewogICAgICB0aHJvdyBuZXcgRXJyb3IoCiAgICAgICAgYCR7cmVsYXRpdmV9OiBtYXJjYWRvciBhdXNlbnRlOiAke21hcmtlcn1gLAogICAgICApOwogICAgfQogIH0KfQoKY29uc29sZS5sb2coIk1QX0FQUExJQ0FUSU9OX0ZFRV9QQVRDSEVEPTEiKTsK
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

    try {
        & $Command @Arguments
        $Code = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $OldPreference
    }

    return $Code
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

Write-Section "ORCALY - CORREÇÃO APPLICATION_FEE MERCADO PAGO - V2"

if (-not (Test-Path -LiteralPath (Join-Path $Root "package.json"))) {
    throw "Execute este script na raiz do projeto Orçaly."
}

$Git = Resolve-Command @("git.exe", "git") "Git"
$Node = Resolve-Command @("node.exe", "node") "Node.js"
$Npm = Resolve-Command @("npm.cmd", "npm") "npm"

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

Write-Section "CRIANDO BACKUP"

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
        $PatchExit = Invoke-Tool `
            $Node `
            @(
                $PatcherPath,
                $Root
            )

        if ($PatchExit -ne 0) {
            throw "O patch falhou."
        }
    }
    finally {
        Remove-Item `
            -LiteralPath $PatcherPath `
            -Force `
            -ErrorAction SilentlyContinue
    }

    $PatchApplied = $true
    Write-Ok "MP_APPLICATION_FEE_PATCHED=1"

    Write-Section "VALIDANDO CÓDIGO"

    & $Git --no-pager diff --check -- @Files

    if ($LASTEXITCODE -ne 0) {
        throw "git diff --check falhou."
    }

    $AdminCheck = Join-Path `
        $Root `
        "scripts\admin-security-check.mjs"

    if (Test-Path -LiteralPath $AdminCheck) {
        $AdminExit = Invoke-Tool `
            $Node `
            @($AdminCheck)

        if ($AdminExit -ne 0) {
            throw "A auditoria administrativa falhou."
        }
    }

    $SecurityExit = Invoke-Tool `
        $Npm `
        @(
            "run",
            "security:check"
        )

    if ($SecurityExit -ne 0) {
        throw "security:check falhou."
    }

    Write-Ok "SECURITY_CHECK_EXIT_CODE=0"

    Write-Section "EXECUTANDO BUILD"

    Remove-Item `
        -LiteralPath (Join-Path $Root ".next") `
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
        throw "O build falhou."
    }

    Write-Ok "BUILD_EXIT_CODE=0"

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

    Write-Section "PUBLICANDO NA VERCEL"

    $Vercel = Get-Command `
        vercel.cmd `
        -ErrorAction SilentlyContinue

    if (-not $Vercel) {
        $Vercel = Get-Command `
            vercel `
            -ErrorAction SilentlyContinue
    }

    if ($Vercel) {
        & $Vercel.Source --prod --yes --force
        $DeployExit = $LASTEXITCODE
    }
    else {
        $Npx = Resolve-Command @("npx.cmd", "npx") "npx"
        & $Npx --yes vercel@latest --prod --yes --force
        $DeployExit = $LASTEXITCODE
    }

    if ($DeployExit -ne 0) {
        Write-Warn "A Vercel retornou código $DeployExit. Como já ocorreu falso negativo, confira o deployment no painel antes de repetir."
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
}
catch {
    Restore-Files
    throw
}
