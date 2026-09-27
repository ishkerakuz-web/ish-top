export class AppError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const Errors = {
  unauthorized: (message = "Avtorizatsiyadan o'tilmagan") =>
    new AppError(401, "UNAUTHORIZED", message),
  forbidden: (message = "Ruxsat yo'q") => new AppError(403, "FORBIDDEN", message),
  notFound: (message = "Topilmadi") => new AppError(404, "NOT_FOUND", message),
  conflict: (message = "Bu yozuv allaqachon mavjud") =>
    new AppError(409, "CONFLICT", message),
  badRequest: (message = "So'rov noto'g'ri") => new AppError(400, "BAD_REQUEST", message),
};
