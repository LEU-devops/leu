import type { MembersChange, OrganizationHierarchy, UserSearchResult } from '../types/organizations'
import { request } from './api'
import { getToken } from './auth'

/** Whether the logged-in user can manage this organization's members (false when logged out). */
export async function canManageOrganizationMembers(id: number): Promise<boolean> {
    if (!getToken())
        return false
    const response: { canManageMembers: boolean } = await request(`/organizations/${id}/permissions`)
    return response.canManageMembers
}

export function searchUsersForOrganization(id: number, query: string): Promise<UserSearchResult[]> {
    return request(`/organizations/${id}/user-search?q=${encodeURIComponent(query)}`)
}

export function updateOrganizationMembers(id: number, change: MembersChange): Promise<OrganizationHierarchy> {
    return request(`/organizations/${id}/members`, {
        method: 'PUT',
        body: JSON.stringify(change),
    })
}
