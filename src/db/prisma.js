import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import process from 'node:process';
import pkg from '@prisma/client';

const { PrismaClient } = pkg;

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter });
