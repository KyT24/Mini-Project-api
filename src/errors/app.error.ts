export class AppError extends Error {
  constructor(
    public status: number,
    public message: string,
  ) {
    super(message);
    this.status = status;
  }
}

throw new AppError(404, "QR code is not valid");