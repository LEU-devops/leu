import type { Knex } from "knex";

export async function seed(knex: Knex): Promise<void> {
  // Delete relation rows first to satisfy FK constraints.
  await knex("organization_users").del();
  await knex("organizations").del();
  await knex("users").del();

  await knex("users")
    .insert([
      {
        email: "user1@example.com",
        nickname: "User 1",
        password: "password1",
        full_name: null,
        ra: null,
        cpf: null,
        profile_photo_url: null,
      },
      {
        email: "user2@example.com",
        nickname: "User 2",
        password: "password2",
        full_name: null,
        ra: null,
        cpf: null,
        profile_photo_url: null,
      },
      {
        email: "user3@example.com",
        nickname: "User 3",
        password: "password3",
        full_name: null,
        ra: null,
        cpf: null,
        profile_photo_url: null,
      },
      {
        email: "user4@example.com",
        nickname: "User 4",
        password: "password4",
        full_name: null,
        ra: null,
        cpf: null,
        profile_photo_url: null,
      },
      {
        email: "user5@example.com",
        nickname: "User 5",
        password: "password5",
        full_name: null,
        ra: null,
        cpf: null,
        profile_photo_url: null,
      },
      {
        email: "user6@example.com",
        nickname: "User 6",
        password: "password6",
        full_name: null,
        ra: null,
        cpf: null,
        profile_photo_url: null,
      },
      {
        email: "user7@example.com",
        nickname: "User 7",
        password: "password7",
        full_name: null,
        ra: null,
        cpf: null,
        profile_photo_url: null,
      },
      {
        email: "user8@example.com",
        nickname: "User 8",
        password: "password8",
        full_name: null,
        ra: null,
        cpf: null,
        profile_photo_url: null,
      },
      {
        email: "user9@example.com",
        nickname: "User 9",
        password: "password9",
        full_name: null,
        ra: null,
        cpf: null,
        profile_photo_url: null,
      },
      {
        email: "user10@example.com",
        nickname: "User 10",
        password: "password10",
        full_name: null,
        ra: null,
        cpf: null,
        profile_photo_url: null,
      },
      {
        email: "user11@example.com",
        nickname: "User 11",
        password: "password11",
        full_name: null,
        ra: null,
        cpf: null,
        profile_photo_url: null,
      },
      {
        email: "user12@example.com",
        nickname: "User 12",
        password: "password12",
        full_name: null,
        ra: null,
        cpf: null,
        profile_photo_url: null,
      },
      {
        email: "user13@example.com",
        nickname: "User 13",
        password: "password13",
        full_name: null,
        ra: null,
        cpf: null,
        profile_photo_url: null,
      },
      {
        email: "user14@example.com",
        nickname: "User 14",
        password: "password14",
        full_name: null,
        ra: null,
        cpf: null,
        profile_photo_url: null,
      },
      {
        email: "user15@example.com",
        nickname: "User 15",
        password: "password15",
        full_name: null,
        ra: null,
        cpf: null,
        profile_photo_url: null,
      },
      {
        email: "user16@example.com",
        nickname: "User 16",
        password: "password16",
        full_name: null,
        ra: null,
        cpf: null,
        profile_photo_url: null,
      },
      {
        email: "user17@example.com",
        nickname: "User 17",
        password: "password17",
        full_name: null,
        ra: null,
        cpf: null,
        profile_photo_url: null,
      },
      {
        email: "user18@example.com",
        nickname: "User 18",
        password: "password18",
        full_name: null,
        ra: null,
        cpf: null,
        profile_photo_url: null,
      },
      {
        email: "user19@example.com",
        nickname: "User 19",
        password: "password19",
        full_name: null,
        ra: null,
        cpf: null,
        profile_photo_url: null,
      },
      {
        email: "user20@example.com",
        nickname: "User 20",
        password: "password20",
        full_name: null,
        ra: null,
        cpf: null,
        profile_photo_url: null,
      },
      {
        email: "user21@example.com",
        nickname: "User 21",
        password: "password21",
        full_name: null,
        ra: null,
        cpf: null,
        profile_photo_url: null,
      },
      {
        email: "user22@example.com",
        nickname: "User 22",
        password: "password22",
        full_name: null,
        ra: null,
        cpf: null,
        profile_photo_url: null,
      },
      {
        email: "user23@example.com",
        nickname: "User 23",
        password: "password23",
        full_name: null,
        ra: null,
        cpf: null,
        profile_photo_url: null,
      },
      {
        email: "user24@example.com",
        nickname: "User 24",
        password: "password24",
        full_name: null,
        ra: null,
        cpf: null,
        profile_photo_url: null,
      },
      {
        email: "user25@example.com",
        nickname: "User 25",
        password: "password25",
        full_name: null,
        ra: null,
        cpf: null,
        profile_photo_url: null,
      },
      {
        email: "user26@example.com",
        nickname: "User 26",
        password: "password26",
        full_name: null,
        ra: null,
        cpf: null,
        profile_photo_url: null,
      },
      {
        email: "user27@example.com",
        nickname: "User 27",
        password: "password27",
        full_name: null,
        ra: null,
        cpf: null,
        profile_photo_url: null,
      },
      {
        email: "user28@example.com",
        nickname: "User 28",
        password: "password28",
        full_name: null,
        ra: null,
        cpf: null,
        profile_photo_url: null,
      },
      {
        email: "user29@example.com",
        nickname: "User 29",
        password: "password29",
        full_name: null,
        ra: null,
        cpf: null,
        profile_photo_url: null,
      },
      {
        email: "user30@example.com",
        nickname: "User 30",
        password: "password30",
        full_name: null,
        ra: null,
        cpf: null,
        profile_photo_url: null,
      },
    ])
    .onConflict("email")
    .ignore(); // Ignore if user already exists

  // Inserts seed entries
  await knex("organizations")
    .insert([
      {
        id: 1,
        name: "LEU",
        description: "Liga das Engenharias da UNICAMP",
        gradient: "linear-gradient(135deg, #7f1d1d 0%, #111827 100%)",
      },
      {
        id: 2,
        name: "AAAKI",
        description: "Associação Atlética Acadêmica Kamal Ismail",
        gradient: "linear-gradient(135deg, #14532d 0%, #052e16 100%)",
      },
      {
        id: 3,
        name: "AAAECA",
        description:
          "Associação Atlética Acadêmica da Engenharia de Controle e Automação",
        gradient: "linear-gradient(135deg, #1e3a8a 0%, #172554 100%)",
      },
      {
        id: 4,
        name: "AAAETA",
        description:
          "Associação Atlética Acadêmica das Engenharias de Telecomunicações, Transportes e Ambiental",
        gradient: "linear-gradient(135deg, #0f766e 0%, #134e4a 100%)",
      },
      {
        id: 5,
        name: "AAAFEA",
        description:
          "Associação Atlética Acadêmica da Faculdade de Engenharia de Alimentos",
        gradient: "linear-gradient(135deg, #854d0e 0%, #422006 100%)",
      },
      {
        id: 6,
        name: "AAAFEAGRI",
        description:
          "Associação Atlética Acadêmica da Faculdade de Engenharia Agrícola",
        gradient: "linear-gradient(135deg, #4d7c0f 0%, #1a2e05 100%)",
      },
      {
        id: 7,
        name: "AAAFEE",
        description:
          "Associação Atlética Acadêmica da Faculdade de Engenharia Elétrica",
        gradient: "linear-gradient(135deg, #9f1239 0%, #4c0519 100%)",
      },
      {
        id: 8,
        name: "AAAFEQ",
        description:
          "Associação Atlética Acadêmica da Faculdade de Engenharia Química",
        gradient: "linear-gradient(135deg, #9a3412 0%, #431407 100%)",
      },
      {
        id: 9,
        name: "AAAMEC",
        description: "Associação Atlética Acadêmica da Engenharia Mecânica",
        gradient: "linear-gradient(135deg, #334155 0%, #0f172a 100%)",
      },
      {
        id: 10,
        name: "AAAXD",
        description: "Associação Atlética Acadêmica X de Dezembro",
        gradient: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
      },
    ])
    .onConflict("name")
    .merge({
      gradient: knex.raw("EXCLUDED.gradient"),
      description: knex.raw("EXCLUDED.description"),
    }); // Update gradient if organization already exists

  await knex("organization_users")
    .insert([
      // LEU
      {
        organization_id: 1,
        user_email: "user1@example.com",
        role: "presidente",
        director_area: null,
      },
      {
        organization_id: 1,
        user_email: "user2@example.com",
        role: "vice",
        director_area: null,
      },
      {
        organization_id: 1,
        user_email: "user3@example.com",
        role: "diretor",
        director_area: "Esportes",
      },
      {
        organization_id: 1,
        user_email: "user4@example.com",
        role: "diretor",
        director_area: "Financeiro",
      },
      {
        organization_id: 1,
        user_email: "user5@example.com",
        role: "membro",
        director_area: null,
      },
      {
        organization_id: 1,
        user_email: "user6@example.com",
        role: "aluno",
        director_area: null,
      },

      // AAAKI
      {
        organization_id: 2,
        user_email: "user7@example.com",
        role: "presidente",
        director_area: null,
      },
      {
        organization_id: 2,
        user_email: "user8@example.com",
        role: "diretor",
        director_area: "Marketing",
      },
      {
        organization_id: 2,
        user_email: "user9@example.com",
        role: "membro",
        director_area: null,
      },
      {
        organization_id: 2,
        user_email: "user10@example.com",
        role: "aluno",
        director_area: null,
      },

      // AAAECA
      {
        organization_id: 3,
        user_email: "user11@example.com",
        role: "presidente",
        director_area: null,
      },
      {
        organization_id: 3,
        user_email: "user12@example.com",
        role: "vice",
        director_area: null,
      },
      {
        organization_id: 3,
        user_email: "user13@example.com",
        role: "diretor",
        director_area: "Eventos",
      },
      {
        organization_id: 3,
        user_email: "user14@example.com",
        role: "membro",
        director_area: null,
      },

      // AAAETA
      {
        organization_id: 4,
        user_email: "user15@example.com",
        role: "presidente",
        director_area: null,
      },
      {
        organization_id: 4,
        user_email: "user16@example.com",
        role: "diretor",
        director_area: "Comunicação",
      },
      {
        organization_id: 4,
        user_email: "user17@example.com",
        role: "membro",
        director_area: null,
      },

      // AAAFEA
      {
        organization_id: 5,
        user_email: "user18@example.com",
        role: "presidente",
        director_area: null,
      },
      {
        organization_id: 5,
        user_email: "user19@example.com",
        role: "vice",
        director_area: null,
      },
      {
        organization_id: 5,
        user_email: "user20@example.com",
        role: "diretor",
        director_area: "Relações Externas",
      },

      // AAAFEAGRI
      {
        organization_id: 6,
        user_email: "user21@example.com",
        role: "presidente",
        director_area: null,
      },
      {
        organization_id: 6,
        user_email: "user22@example.com",
        role: "membro",
        director_area: null,
      },

      // AAAFEE
      {
        organization_id: 7,
        user_email: "user23@example.com",
        role: "presidente",
        director_area: null,
      },
      {
        organization_id: 7,
        user_email: "user24@example.com",
        role: "diretor",
        director_area: "Acadêmico",
      },

      // AAAFEQ
      {
        organization_id: 8,
        user_email: "user25@example.com",
        role: "presidente",
        director_area: null,
      },
      {
        organization_id: 8,
        user_email: "user26@example.com",
        role: "aluno",
        director_area: null,
      },

      // AAAMEC
      {
        organization_id: 9,
        user_email: "user27@example.com",
        role: "presidente",
        director_area: null,
      },
      {
        organization_id: 9,
        user_email: "user28@example.com",
        role: "membro",
        director_area: null,
      },

      // AAAXD
      {
        organization_id: 10,
        user_email: "user29@example.com",
        role: "presidente",
        director_area: null,
      },
      {
        organization_id: 10,
        user_email: "user30@example.com",
        role: "diretor",
        director_area: "Tecnologia",
      },
    ])
    .onConflict(["organization_id", "user_email"])
    .ignore();
}
