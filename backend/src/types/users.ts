/** Row shape of the `users` table. */
export interface User {
  email: string;
  password: string;
  nickname: string;
  full_name: string | null;
  ra: string | null;
  cpf: string | null;
  profile_photo_url: string | null;
}

export interface UserPayload {
  email: string;
  nickname: string;
  full_name: string | null;
  profile_photo_url: string | null;
}

declare module "knex/types/tables" {
  interface Tables {
    users: User;
    permissions: {
      email: User["email"];
      permission: string;
    };
  }
}
