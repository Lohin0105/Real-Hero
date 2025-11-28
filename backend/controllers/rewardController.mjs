// backend/controllers/rewardController.mjs
import User from "../models/User.mjs";
import RewardLog from "../models/RewardLog.mjs";

/**
 * GET /api/rewards/leaderboard
 * Get top 50 users by leaderboard points
 */
export const getLeaderboard = async (req, res) => {
    try {
        const topUsers = await User.find({})
            .sort({ leaderboardPoints: -1 })
            .limit(50)
            .select("name leaderboardPoints coins")
            .lean();

        return res.json(topUsers);
    } catch (e) {
        console.error("getLeaderboard error:", e);
        return res.status(500).json({ error: e.message });
    }
};

/**
 * GET /api/rewards/my-rewards
 * Query: { uid }
 * Get user's reward history
 */
export const getMyRewards = async (req, res) => {
    try {
        const { uid } = req.query;
        const user = await User.findOne({ uid });
        if (!user) return res.json([]);

        const rewards = await RewardLog.find({ userId: user._id })
            .sort({ createdAt: -1 })
            .lean();

        return res.json(rewards);
    } catch (e) {
        console.error("getMyRewards error:", e);
        return res.status(500).json({ error: e.message });
    }
};
