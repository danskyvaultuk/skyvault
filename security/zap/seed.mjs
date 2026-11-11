// Seed for the ZAP scan harness: placeholder rows under fixed literal ids, so a re-seed restores the same state
// after any scan. Importing this file exports SEED and touches no database; executing it reseeds the database
// named by DATABASE_URL (run it inside the app image, which carries the Prisma client).
import { pathToFileURL } from 'node:url';

export const SEED = {
  users: {
    customerA: {
      id: 'svzap-user-customer-a',
      email: 'customer-a@example.test',
      name: 'Customer A',
      picture: null,
      role: 'customer',
    },
    customerB: {
      id: 'svzap-user-customer-b',
      email: 'customer-b@example.test',
      name: 'Customer B',
      picture: null,
      role: 'customer',
    },
    admin: {
      id: 'svzap-user-admin',
      email: 'admin@example.test',
      name: 'Admin',
      picture: null,
      role: 'admin',
    },
  },
  property: {
    id: 'svzap-property-a',
    address: '1 Placeholder Street',
    postcode: 'ZZ99 1AA',
  },
  surveys: {
    s1: {
      id: 'svzap-survey-s1',
      status: 'draft',
      images: [{ id: 'svzap-image-s1', s3Key: 'svzap/placeholder-s1.jpg' }],
    },
    s2: {
      id: 'svzap-survey-s2',
      status: 'complete',
      report: { id: 'svzap-report-s2', conditionScore: 50 },
      lead: { id: 'svzap-lead-s2', postcode: 'ZZ99 1AA' },
    },
  },
  unseededDroneJobId: 'svzap-dronejob-unseeded',
};

async function main() {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const { users, property, surveys } = SEED;
  const userIds = Object.values(users).map((user) => user.id);
  try {
    // Lead.reportId is ON DELETE RESTRICT, so the seeded leads go first; deleting the users then cascades the
    // properties, surveys, images and reports.
    await prisma.lead.deleteMany({ where: { survey: { customerId: { in: userIds } } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });

    for (const user of Object.values(users)) {
      await prisma.user.create({
        data: { id: user.id, email: user.email, name: user.name, image: user.picture, role: user.role },
      });
    }
    await prisma.property.create({
      data: {
        id: property.id,
        ownerId: users.customerA.id,
        address: property.address,
        postcode: property.postcode,
      },
    });
    await prisma.survey.create({
      data: {
        id: surveys.s1.id,
        propertyId: property.id,
        customerId: users.customerA.id,
        type: 'self_upload',
        status: surveys.s1.status,
        images: {
          create: surveys.s1.images.map((image) => ({
            id: image.id,
            uploadedById: users.customerA.id,
            s3Key: image.s3Key,
          })),
        },
      },
    });
    await prisma.survey.create({
      data: {
        id: surveys.s2.id,
        propertyId: property.id,
        customerId: users.customerA.id,
        type: 'self_upload',
        status: surveys.s2.status,
        report: {
          create: {
            id: surveys.s2.report.id,
            conditionScore: surveys.s2.report.conditionScore,
            defectsJson: [],
            recommendations: [],
            confidence: 'low',
          },
        },
      },
    });
    await prisma.lead.create({
      data: {
        id: surveys.s2.lead.id,
        surveyId: surveys.s2.id,
        reportId: surveys.s2.report.id,
        postcode: surveys.s2.lead.postcode,
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`seed: ${error.message}`);
    process.exit(1);
  });
}
