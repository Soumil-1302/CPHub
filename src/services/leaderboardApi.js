import { apiRequest } from './api'

export function getLeaderboard({
  limit = 20,
  offset = 0,
  branch,
  graduationYear,
  sortBy = 'total_solved',
  sortOrder = 'desc',
  search,
} = {}) {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    sort_by: sortBy,
    sort_order: sortOrder,
  })
  if (branch && branch !== 'ALL') params.set('branch', branch)
  if (graduationYear && graduationYear !== 'ALL') params.set('year', graduationYear)
  if (search?.trim()) params.set('search', search.trim())

  return apiRequest(`/api/leaderboard?${params.toString()}`)
}
