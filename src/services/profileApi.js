import { apiRequest } from './api'

export function getPublicProfile(username) {
  return apiRequest(`/api/profile/${encodeURIComponent(username)}`)
}

export function getMyProfile() {
  return apiRequest('/api/profile/me', { auth: true })
}

export function getRegistrationDraft() {
  return apiRequest('/api/profile/me/registration-draft', { auth: true })
}

export function registerMyProfile(profile) {
  return apiRequest('/api/profile/registration', {
    method: 'POST',
    auth: true,
    body: JSON.stringify(profile),
  })
}

export function updateMyProfile(profile) {
  return apiRequest('/api/profile/me', {
    method: 'PUT',
    auth: true,
    body: JSON.stringify(profile),
  })
}

export async function getMyLeetcodeStats() {
  const response = await apiRequest('/api/leetcode/stats', { auth: true })
  return response?.username ? response : response?.data?.username ? response.data : null
}

export function refreshMyLeetcodeStats() {
  return apiRequest('/api/leetcode/sync', { method: 'POST', auth: true })
}

export async function getBranchOptions() {
  const response = await apiRequest('/api/branches')
  return response.branches
}
