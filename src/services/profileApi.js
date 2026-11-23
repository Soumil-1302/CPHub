import { apiRequest } from './api'

export function getPublicProfile(username) {
  return apiRequest(`/api/profile/${encodeURIComponent(username)}`)
}

export async function getBranchOptions() {
  const response = await apiRequest('/api/branches')
  return response.branches
}
