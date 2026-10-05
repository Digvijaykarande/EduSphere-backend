import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  applyLeaveSchema,
  reviewLeaveSchema,
  leaveInboxQuerySchema,
} from "../validations/leave.validation.js";
import {
  applyForLeave,
  getMyLeaves,
  getLeaveInbox,
  approveLeave,
  denyLeave,
} from "../services/leave.service.js";

export const applyLeaveHandler = asyncHandler(async (req, res) => {
  const data = applyLeaveSchema.parse(req.body);
  const leave = await applyForLeave(req.user, data);
  return ApiResponse.success(res, "Leave application submitted", { leave }, 201);
});

export const getMyLeavesHandler = asyncHandler(async (req, res) => {
  const leaves = await getMyLeaves(req.user);
  return ApiResponse.success(res, "Your leave history retrieved", { leaves });
});

export const getLeaveInboxHandler = asyncHandler(async (req, res) => {
  const query = leaveInboxQuerySchema.parse(req.query);
  const leaves = await getLeaveInbox(req.user, query);
  return ApiResponse.success(res, "Leave inbox retrieved", { leaves });
});

export const approveLeaveHandler = asyncHandler(async (req, res) => {
  const { reviewerNote } = reviewLeaveSchema.parse(req.body);
  const leave = await approveLeave(req.user, req.params.slug, reviewerNote);
  return ApiResponse.success(res, "Leave approved", { leave });
});

export const denyLeaveHandler = asyncHandler(async (req, res) => {
  const { reviewerNote } = reviewLeaveSchema.parse(req.body);
  const leave = await denyLeave(req.user, req.params.slug, reviewerNote);
  return ApiResponse.success(res, "Leave denied", { leave });
});
