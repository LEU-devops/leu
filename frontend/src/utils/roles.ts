import type { OrganizationMember, OrganizationRole } from '../types/organizations'

export const ROLE_OPTIONS: { value: OrganizationRole, label: string }[] = [
    { value: 'presidente', label: 'Presidente' },
    { value: 'vice', label: 'Vice-presidente' },
    { value: 'diretor', label: 'Diretor(a)' },
    { value: 'conselheiro', label: 'Conselheiro(a)' },
    { value: 'membro', label: 'Membro da gestão' },
    { value: 'aluno', label: 'Aluno(a)' },
]

type Position = Pick<OrganizationMember, 'role' | 'director_area'>

export function roleLabel({ role, director_area }: Position): string {
    if (role === 'diretor')
        return director_area ? `Diretor(a) de ${director_area}` : 'Diretor(a)'
    return ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role
}
