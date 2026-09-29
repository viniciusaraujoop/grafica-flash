export type NotificationScopeRow = {
  company_id: string
  user_id: string | null
  status?: string | null
}

export function notificationVisibilityFilter(userId: string) {
  return `user_id.is.null,user_id.eq.${userId}`
}

export function notificationVisibleToRequester(
  row: NotificationScopeRow,
  requesterCompanyId: string,
  requesterUserId: string,
) {
  return row.company_id === requesterCompanyId
    && (row.user_id === null || row.user_id === requesterUserId)
}

export function notificationMutableByRequester(
  row: NotificationScopeRow,
  requesterCompanyId: string,
  requesterUserId: string,
) {
  return row.company_id === requesterCompanyId
    && row.user_id === requesterUserId
}
