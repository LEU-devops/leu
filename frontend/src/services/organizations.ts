import type { Period, PositionPeriod } from '../types/sports'
import type { IdentityChange, IdentityImage, MembersChange, OrganizationHierarchy, OrganizationRole, OrganizationPermissions, UserSearchResult } from '../types/organizations'
import { request } from './api'
import { getToken } from './auth'

const NO_PERMISSIONS: OrganizationPermissions = { canManageMembers: false, canManageIdentity: false, canManageSports: false }

/** What the logged-in user can manage in this organization (nothing when logged out). */
export async function getOrganizationPermissions(id: number): Promise<OrganizationPermissions> {
    if (!getToken())
        return NO_PERMISSIONS
    return request(`/organizations/${id}/permissions`)
}

/** Any user by name, nickname or e-mail (logged-in only). */
export function searchUsers(query: string): Promise<UserSearchResult[]> {
    return request(`/users/search?q=${encodeURIComponent(query)}`)
}

export function updateOrganizationMembers(id: number, change: MembersChange): Promise<OrganizationHierarchy> {
    return request(`/organizations/${id}/members`, {
        method: 'PUT',
        body: JSON.stringify(change),
    })
}

export function getOrganizationPositions(id: number): Promise<PositionPeriod[]> {
    return request(`/organizations/${id}/positions`)
}

export function createOrganizationPosition(
    id: number,
    position: Period & { email: string, role: OrganizationRole, director_area: string | null },
): Promise<PositionPeriod[]> {
    return request(`/organizations/${id}/positions`, { method: 'POST', body: JSON.stringify(position) })
}

export function updateOrganizationPosition(id: number, positionId: number, period: Period): Promise<PositionPeriod[]> {
    return request(`/organizations/${id}/positions/${positionId}`, { method: 'PUT', body: JSON.stringify(period) })
}

export function deleteOrganizationPosition(id: number, positionId: number): Promise<PositionPeriod[]> {
    return request(`/organizations/${id}/positions/${positionId}`, { method: 'DELETE' })
}

export function updateOrganizationIdentity(id: number, change: IdentityChange): Promise<OrganizationHierarchy> {
    return request(`/organizations/${id}/identity`, {
        method: 'PUT',
        body: JSON.stringify(change),
    })
}

export async function uploadOrganizationImage(id: number, kind: IdentityImage, file: File): Promise<OrganizationHierarchy> {
    return request(`/organizations/${id}/images/${kind}`, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: await file.arrayBuffer(),
    })
}

export function deleteOrganizationImage(id: number, kind: IdentityImage): Promise<OrganizationHierarchy> {
    return request(`/organizations/${id}/images/${kind}`, { method: 'DELETE' })
}

/** Absolute URL of an uploaded file (logo, banner, photo) served by the API. */
export function uploadUrl(path: string): string {
    return `${import.meta.env.VITE_API_URL}${path}`
}
