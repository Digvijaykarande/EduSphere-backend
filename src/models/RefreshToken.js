import mongoose from "mongoose";

const refreshTokenSchema = new mongoose.Schema(
  {
    // sha256 of the raw refresh JWT. Raw value never persisted.
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // jti claim from the JWT, for traceability when rotating.
    jti: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    ua: {
      type: String,
      default: "",
    },
    ip: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// Mongo TTL index — Mongo will physically remove expired tokens.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default (
  mongoose.models.RefreshToken ||
  mongoose.model("RefreshToken", refreshTokenSchema)
);
