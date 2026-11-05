import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  /** @example dispatcher@gfs.demo */
  @IsEmail()
  email: string;

  /** @example Demo1234! */
  @IsString()
  @MinLength(8)
  password: string;
}
