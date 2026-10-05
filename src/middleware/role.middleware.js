import AppError from "../utils/AppError.js";

export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new AppError(
          `Forbidden: Role '${req.user?.role || "GUEST"}' is not authorized to access this resource`,
          403
        )
      );
    }
    next();
  };
};
