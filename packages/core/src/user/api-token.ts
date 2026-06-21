import { prisma } from '@shumai/db'

export class ApiTokenService {
  async listTokens(userId: string) {
    return prisma.apiToken.findMany({
      where: { userId },
      orderBy: { id: 'desc' },
    })
  }

  async createToken(userId: string, name: string) {
    return prisma.apiToken.create({
      data: {
        userId,
        name,
      },
    })
  }

  async deleteToken(userId: string, tokenId: string) {
    return prisma.apiToken.delete({
      where: {
        id: tokenId,
        userId,
      },
    })
  }

  async validateToken(tokenString: string) {
    const apiToken = await prisma.apiToken.findUnique({
      where: { token: tokenString },
      include: { user: true },
    })
    return apiToken ? apiToken.user : null
  }
}

export const apiTokenService = new ApiTokenService()
