import { ZodError } from "zod";

export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";
  let errors = null;

  // Zod Validation Error
  if (err instanceof ZodError) {
    statusCode = 400;
    message = "Validation Error";
    errors = err.errors.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    }));
  }
  // Mongoose Duplicate Key Error
  else if (err.code === 11000) {
    statusCode = 400;
    const key = Object.keys(err.keyValue)[0];
    message = `Duplicate value entered for '${key}'. Please use another value.`;
  }
  // Mongoose CastError (e.g. invalid ObjectId)
  else if (err.name === "CastError") {
    statusCode = 400;
    message = `Resource not found. Invalid ID format for '${err.path}'`;
  }
  // JWT Errors
  else if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid authentication token";
  } else if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Authentication token expired";
  }

  if (process.env.NODE_ENV === "development" && statusCode === 500) {
    console.error("🔥 SERVER ERROR STACK:", err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
  });
};
