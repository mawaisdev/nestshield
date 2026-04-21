import { AppDataSource } from '../data-source';

const roles = [
  {
    name: 'admin',
    description: 'Administrator with full access',
  },
  {
    name: 'user',
    description: 'Regular user with limited access',
  },
];

async function seedRoles() {
  await AppDataSource.initialize();

  console.log('Seeding roles...');
  for (const role of roles) {
    await AppDataSource.query(
      `INSERT INTO roles (name, description)
        VALUES ($1, $2)
        ON CONFLICT (name) DO NOTHING`,
      [role.name, role.description],
    );
    console.log(`✓ Role "${role.name}" seeded`);
  }

  console.log('Seeding complete.');
  await AppDataSource.destroy();
}

seedRoles().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
