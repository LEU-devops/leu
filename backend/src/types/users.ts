/** Row shape of the `users` table. */
export interface User {
    email: string;
    password: string;
    name: string;
}

export interface UserPayload {
    email: string;
    name: string;
}

declare module "knex/types/tables" {
    interface Tables {
        users: User;
        permissions: {
            email: User['email'];
            permission: string;
        }
    }
}
