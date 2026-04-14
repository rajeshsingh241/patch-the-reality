export type ContentType = "image" | "video";
export type ReputationLevel = "Newcomer" | "Trusted" | "Expert";

export interface Poll {
  id: string;
  content_url?: string;
  claim: string;
  aiQuestion: string;
  fullDescription: string;
  contentType: ContentType;
  category: string;
  categoryColor: string;
  yesVotes: number;
  noVotes: number;
  timeRemaining: string;
  tokenReward: number;
  gradientFrom: string;
  gradientTo: string;
  thumbnailIcon: string;
  postedBy: string;
  postedAgo: string;
}

export interface Activity {
  id: string;
  type: "voted" | "published" | "cashout";
  description: string;
  pollTitle: string;
  tokens: number;
  correct?: boolean;
  timestamp: string;
}

export interface UserProfile {
  username: string;
  walletAddress: string;
  tokenBalance: number;
  tokensToNextCashout: number;
  cashoutThreshold: number;
  totalEarned: number;
  accuracyScore: number;
  totalVotes: number;
  correctVotes: number;
  reputation: ReputationLevel;
  reputationPoints: number;
  nextReputationThreshold: number;
  joinedDate: string;
  pollsPublished: number;
  recentActivity: Activity[];
}

export const polls: Poll[] = [
  {
    id: "1",
    claim:
      'Is this viral photo of a "blue waterfall" in Iceland real or digitally altered?',
    aiQuestion:
      "Does this image authentically depict a naturally occurring blue waterfall in Iceland, or has it been digitally manipulated?",
    fullDescription:
      'A stunning image circulating on social media claims to show a vibrant blue waterfall located in the Highlands of Iceland. The image has been shared over 50,000 times with captions claiming it\'s a "hidden gem." Geological and photography experts have raised doubts about the color saturation.',
    contentType: "image",
    category: "Nature",
    categoryColor: "#059669",
    yesVotes: 847,
    noVotes: 312,
    timeRemaining: "2h 14m",
    tokenReward: 10,
    gradientFrom: "#0c2340",
    gradientTo: "#1a4060",
    thumbnailIcon: "🌊",
    postedBy: "NatureFact_42",
    postedAgo: "3h ago",
  },
  {
    id: "2",
    claim:
      "Breaking: Senator claims new bill will eliminate income tax for middle class entirely",
    aiQuestion:
      "Does the proposed legislation accurately and completely eliminate income tax obligations for middle-class Americans as claimed?",
    fullDescription:
      'A video clip of a senator going viral shows him claiming a new bill "will completely eliminate income taxes for the middle class." The clip has been viewed 2.3 million times. The full bill text and context tell a very different story.',
    contentType: "video",
    category: "Politics",
    categoryColor: "#dc2626",
    yesVotes: 234,
    noVotes: 1456,
    timeRemaining: "45m",
    tokenReward: 15,
    gradientFrom: "#3b0000",
    gradientTo: "#600a0a",
    thumbnailIcon: "🏛️",
    postedBy: "PolitiFact_User",
    postedAgo: "1h ago",
  },
  {
    id: "3",
    claim:
      "New study claims drinking coffee daily reduces Alzheimer's risk by 65%",
    aiQuestion:
      "Is the claimed 65% reduction in Alzheimer's risk from daily coffee consumption supported by the referenced scientific study?",
    fullDescription:
      'Multiple health news outlets are reporting a "breakthrough" study claiming daily coffee consumption reduces Alzheimer\'s disease risk by 65%. The study is attributed to researchers at a European university, but peer review status is unclear.',
    contentType: "image",
    category: "Health",
    categoryColor: "#0891b2",
    yesVotes: 512,
    noVotes: 489,
    timeRemaining: "5h 30m",
    tokenReward: 10,
    gradientFrom: "#0a2a3a",
    gradientTo: "#0d3d55",
    thumbnailIcon: "☕",
    postedBy: "HealthCheck_Pro",
    postedAgo: "30m ago",
  },
  {
    id: "4",
    claim:
      "Video shows Tesla Cybertruck surviving a point-blank explosion in a military test",
    aiQuestion:
      "Does this video authentically show a Tesla Cybertruck undergoing and surviving a military-grade explosion resistance test?",
    fullDescription:
      "A dramatic video circulating on social media appears to show a Tesla Cybertruck being subjected to an explosion at close range during what is claimed to be a military durability test, with the vehicle driving away afterward.",
    contentType: "video",
    category: "Technology",
    categoryColor: "#7c3aed",
    yesVotes: 1203,
    noVotes: 2847,
    timeRemaining: "8h 45m",
    tokenReward: 10,
    gradientFrom: "#1a0a3a",
    gradientTo: "#2d1060",
    thumbnailIcon: "⚡",
    postedBy: "TechDebunker",
    postedAgo: "5h ago",
  },
  {
    id: "5",
    claim:
      "AI-generated image passed off as real photo of tornado striking Times Square",
    aiQuestion:
      "Is this image a genuine photograph of a tornado striking Times Square in New York City, or is it AI-generated or digitally manipulated?",
    fullDescription:
      "An image spreading rapidly across Twitter/X and Facebook shows what appears to be a massive tornado touching down in Times Square, New York City. No weather events were reported in NYC on the alleged date.",
    contentType: "image",
    category: "Weather",
    categoryColor: "#b45309",
    yesVotes: 98,
    noVotes: 3421,
    timeRemaining: "1h 22m",
    tokenReward: 10,
    gradientFrom: "#1a1200",
    gradientTo: "#2d2000",
    thumbnailIcon: "🌪️",
    postedBy: "WeatherWatch_AI",
    postedAgo: "2h ago",
  },
  {
    id: "6",
    claim:
      "Leaked document shows major bank planning to freeze all crypto withdrawals next month",
    aiQuestion:
      "Is this document a genuine internal communication from the claimed bank indicating plans to freeze cryptocurrency withdrawals?",
    fullDescription:
      'A document purportedly leaked from a major financial institution claims the bank will freeze all cryptocurrency-related withdrawals starting next month "due to regulatory pressure." The document is spreading rapidly in crypto communities.',
    contentType: "image",
    category: "Finance",
    categoryColor: "#d97706",
    yesVotes: 445,
    noVotes: 1102,
    timeRemaining: "12h 0m",
    tokenReward: 20,
    gradientFrom: "#1a0f00",
    gradientTo: "#2d1a00",
    thumbnailIcon: "🏦",
    postedBy: "CryptoTruth",
    postedAgo: "15m ago",
  },
];

export const userProfile: UserProfile = {
  username: "CryptoVerifier_42",
  walletAddress: "0x7a3bF9c2D4e1A856f3C0B92d7E4F1a2b3C4D5E6F",
  tokenBalance: 340,
  tokensToNextCashout: 60,
  cashoutThreshold: 100,
  totalEarned: 1240,
  accuracyScore: 78,
  totalVotes: 142,
  correctVotes: 111,
  reputation: "Trusted",
  reputationPoints: 340,
  nextReputationThreshold: 500,
  joinedDate: "March 2024",
  pollsPublished: 7,
  recentActivity: [
    {
      id: "a1",
      type: "voted",
      description: "Voted YES",
      pollTitle: "Blue waterfall in Iceland photo",
      tokens: 10,
      correct: true,
      timestamp: "2h ago",
    },
    {
      id: "a2",
      type: "voted",
      description: "Voted NO",
      pollTitle: "Senator income tax elimination claim",
      tokens: 10,
      correct: true,
      timestamp: "4h ago",
    },
    {
      id: "a3",
      type: "voted",
      description: "Voted YES",
      pollTitle: "Tesla Cybertruck explosion video",
      tokens: -3,
      correct: false,
      timestamp: "6h ago",
    },
    {
      id: "a4",
      type: "published",
      description: "Published poll",
      pollTitle: "Flood damage photo in Florida",
      tokens: 5,
      timestamp: "1d ago",
    },
    {
      id: "a5",
      type: "voted",
      description: "Voted NO",
      pollTitle: "AI tornado Times Square image",
      tokens: 10,
      correct: true,
      timestamp: "1d ago",
    },
    {
      id: "a6",
      type: "cashout",
      description: "Cashed out",
      pollTitle: "$1.00 → MetaMask wallet",
      tokens: -100,
      timestamp: "3d ago",
    },
    {
      id: "a7",
      type: "voted",
      description: "Voted NO",
      pollTitle: "Coffee reduces Alzheimer's by 65%",
      tokens: -3,
      correct: false,
      timestamp: "3d ago",
    },
  ],
};

export const aiGeneratedQuestion =
  "Does the uploaded footage authentically depict the claimed event occurring in the stated location and time period, or does it show evidence of manipulation or misrepresentation?";
