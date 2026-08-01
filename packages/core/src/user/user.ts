import { prisma } from '@shumai/db'

export class UserService {
  constructor(private readonly prismaClient: typeof prisma = prisma) {}

  async getUserById(id: string) {
    return this.prismaClient.user.findUnique({
      where: { id },
    })
  }

  async createGuestUser(data: { name: string; email: string; guestEmail: string }) {
    return this.prismaClient.user.create({
      data: {
        name: data.name,
        email: data.email,
        guestEmail: data.guestEmail,
        type: 'human',
      },
    })
  }
}

export const userService = new UserService()
