/** Tipos compartidos de autenticación. */

/** Carga útil firmada dentro del JWT. */
export interface JwtPayload {
  /** Id del usuario. */
  sub: string;
  email: string;
}

/** Usuario autenticado adjunto a la request por la estrategia JWT. */
export interface AuthUser {
  userId: string;
  email: string;
}
