const BASE_GQL = "https://api.trovo.live/graphql";
const BASE_BACKUP_GQL = "https://api-backup.trovo.live/graphql";

const GQL = BASE_GQL;
const GQL_WEB = BASE_GQL.replace("api", "api-web");
const GQL_WEB_BACKUP = BASE_BACKUP_GQL.replace("api", "api-web");
const GQL_OPEN = BASE_GQL.replace("api", "open-api");
const GQL_FR_WEB = BASE_GQL.replace("api", "fr-api-web");
const GQL_FR_WEB_BACKUP = BASE_BACKUP_GQL.replace("api", "fr-api-web-backup");
const GQL_SV_WEB = BASE_GQL.replace("api", "sv-api-web");
const GQL_SV_WEB_BACKUP = BASE_BACKUP_GQL.replace("api", "sv-api-web-backup");

const URL_BASE = 'https://trovo.live';

const URL_CHANNEL_PREFIX = `${URL_BASE}/s`;
const URL_CHANNEL_SUFFIX_LIVE = `?roomType=1`;
const URL_CHANNEL_SUFFIX_TEXT = `?roomType=2`;
const URL_CHANNEL_SUFFIX_DETAILS = `?roomType=3`;
const URL_CHANNEL_SUFFIX_VIDEOS = `?roomType=4`;
const URL_SEARCH = `${URL_BASE}/search?q=`;
const URL_LIVE_CHAT = `${URL_BASE}/chat`

const _URL_FOLLOWING = `${URL_BASE}/following`;
const URL_FOLLOWING = `${URL_BASE}/subscriptions?tab=following`;
const URL_SUBSCRIPTIONS = `${URL_BASE}/subscriptions?tab=subscribing`;
const PLATFORM = "Trovo";

const REGEX_USER = /trovo\.live\/(?:s\/)?([^\/?]+)/i;
const REGEX_VOD = /(?:\?|&)vid=([a-z0-9_-]+)/i;
const REGEX_CHANNEL = /trovo\.live\/(?:s\/)?([^\/?]+)(?:\/(\d+))?(?:\/)?(?:\?((?!vid=).)*)?$/i;

var config = {};

//Source Methods
source.enable = function (conf) {
    /**
     * @param conf: SourceV8PluginConfig (the TrovoConfig.js)
     */

    config = conf ?? {};
}

source.disable = function () {
    /**
     * Called when the source is disabled.
     * You can use this to clean up any resources or connections.
     */
    config = {};
    log("Source disabled");
}

/*
source.getUserSubscriptions = function () {
    if (!bridge.isLoggedIn()) {
        bridge.log("Failed to retrieve subscriptions page because not logged in.");
        throw new LoginRequiredException("Not logged in");
    }

    const op = [
        {
            operationName: "profile_FollowPage_GetMoreFollowedUsers",
            variables: {
                params: {
                    uid: bridge.getCurrentUserId(),
                    sort: "Undefined",
                    start: 0,
                    count: 50
                }
            }
        }
    ];
    
    const results = callGQL(op);
    
    const list = results.profile_FollowPage_GetMoreFollowedUsers?.list;
    const users = Array.isArray(list?.users) ? list.users : [];
    
    return users.map(u => `${URL_CHANNEL}/${u.userName}`)
}
*/

source.getHome = function (continuationToken) {
    /**
     * @param continuationToken: any?
     * @returns: VideoPager
     */
    const videos = []; // The results (PlatformVideo)
    const hasMore = false; // Are there more pages?
    const context = { continuationToken: continuationToken }; // Relevant data for the next page
    return new TrovoHomeVideoPager(videos, hasMore, context);
}

source.searchSuggestions = function (query) {
    /**
     * @param query: string
     * @returns: string[]
     */

    let op = [{
        operationName: "search_SearchService_SearchSuggest",
        variables: {
            params: {
                query: query,
                pageSize: 8
            }
        },
    }]
    const results = callGQL(op);

    const words = results.search_SearchService_SearchSuggest?.words || [];

    const suggestions = words.map(w => w.word); //The suggestions for a specific search query
    return suggestions;
}

source.getSearchCapabilities = function () {
    //This is an example of how to return search capabilities like available sorts, filters and which feed types are available (see source.js for more details) 
    return {
        types: [Type.Feed.Mixed],
        sorts: [Type.Order.Chronological, "^release_time"],
        filters: []
    };
}

source.search = function (query, type, order, filters, continuationToken) {
    /**
     * @param query: string
     * @param type: string
     * @param order: string
     * @param filters: Map<string, Array<string>>
     * @param continuationToken: any?
     * @returns: VideoPager
     */

    const pageSize = 10;
    let token = continuationToken ? { ...continuationToken } : {
        offset: 0,
        currPage: 1,
        sessionID: null
    };

    const params = {
        query: query,
        num: pageSize,
        pageSize: pageSize,
        currPage: token.currPage,
        offset: token.offset,
        sessionID: token.sessionID || ""
    };

    const op = [{
        operationName: "search_SearchService_SearchLives",
        variables: { params }
    }];

    const results = callGQL(op);

    token = {
        offset: token.offset + pageSize,
        currPage: token.currPage + 1,
        sessionID: results.search_SearchService_SearchLives?.sessionID || token.sessionID
    };

    const lives = results.search_SearchService_SearchLives?.lives || [];

    const videos = lives.map(live => {
        return new PlatformVideo({
            id: new PlatformID(PLATFORM, live.programInfo.id, plugin.config.id),
            name: live.programInfo.title,
            thumbnails: new Thumbnails([new Thumbnail(live.programInfo.coverUrl)]),
            author: new PlatformAuthorLink(
                new PlatformID(PLATFORM, live.userInfo?.uid.toString(), plugin.config.id),
                live.userInfo.nickName,
                `${URL_CHANNEL_PREFIX}/${live.userInfo.userName}`,
                live.userInfo.faceUrl,
                0
            ),
            uploadDate: parseInt(live.programInfo.startTm),
            viewCount: parseFloat(live.channelInfo.viewers),
            url: `${URL_CHANNEL_PREFIX}/${live.userInfo.userName}`,
            isLive: true
        });
    });
    const hasMore = results.search_SearchService_SearchLives?.hasMore || false;
    const context = { query: query, type: type, order: order, filters: filters, continuationToken: token };
    return new TrovoSearchVideoPager(videos, hasMore, context);
}

source.getSearchChannelContentsCapabilities = function () {
    //This is an example of how to return search capabilities on a channel like available sorts, filters and which feed types are available (see source.js for more details)
    return {
        types: [Type.Feed.Mixed],
        sorts: [Type.Order.Chronological],
        filters: []
    };
}

source.searchChannelContents = function (url, query, type, order, filters, continuationToken) {
    /**
     * @param url: string
     * @param query: string
     * @param type: string
     * @param order: string
     * @param filters: Map<string, Array<string>>
     * @param continuationToken: any?
     * @returns: VideoPager
     */

    const videos = []; // The results (PlatformVideo)
    const hasMore = false; // Are there more pages?
    const context = { url: url, query: query, type: type, order: order, filters: filters, continuationToken: continuationToken }; // Relevant data for the next page
    return new TrovoSearchChannelVideoPager(videos, hasMore, context);
}

source.searchChannels = function (query, continuationToken) {
    /**
     * @param query: string
     * @param continuationToken: any?
     * @returns: ChannelPager
     */

    const pageSize = 6;
    let token = continuationToken ? { ...continuationToken } : {
        currPage: 1,
        offset: 0,
        sessionID: null
    };

    const params = {
        query: query,
        pageSize: pageSize,
        currPage: token.currPage,
        offset: token.offset,
        num: pageSize
    };

    if (token.sessionID) {
        params.sessionID = token.sessionID;
    }

    const op = [{
        operationName: "search_SearchService_SearchStreamers",
        variables: { params },
        extensions: { singleReq: true }
    }];

    const results = callGQL(op);

    token = {
        currPage: token.currPage + 1,
        offset: token.offset + pageSize,
        sessionID: results.search_SearchService_SearchStreamers?.sessionID || token.sessionID
    };

    const streamerInfos = results.search_SearchService_SearchStreamers?.streamerInfos || [];

    const channels = streamerInfos.map(channel => {
        const socialLinks = { ...(channel.userInfo.socialLinks || {}) };
        delete socialLinks.socialLinks;
        const cleanLinks = Object.fromEntries(
            Object.entries(socialLinks).filter(([_, value]) =>
                value && typeof value === 'string' && value.trim() !== ''
            )
        );
        return new PlatformChannel({
            id: new PlatformID(PLATFORM, channel.userInfo?.uid.toString(), plugin.config.id),
            name: channel.userInfo?.nickName,
            thumbnail: channel.userInfo?.faceUrl || "",
            subscribers: channel.followers ?? 0,
            description: channel.userInfo?.info || "",
            url: `${URL_CHANNEL_PREFIX}/${channel.userInfo?.userName}`,
            urlAlternatives: [
                `${URL_BASE}/${channel.userInfo?.userName}`,
                `${URL_CHANNEL_PREFIX}/${channel.userInfo?.userName}`
            ],
            links: cleanLinks
        });
    });

    const hasMore = results.search_SearchService_SearchStreamers?.hasMore || false;
    const context = { query: query, continuationToken: token };
    return new TrovoChannelPager(channels, hasMore, context);
};

//Channel
source.isChannelUrl = function (url) {
    /**
     * @param url: string
     * @returns: boolean
     */

    return REGEX_CHANNEL.test(url) && !REGEX_VOD.test(url);
}

source.getChannel = function (url) {
    /**
     * @param url: string
     * @returns: PlatformChannel
     */

    const match = url.match(REGEX_USER);
    if (!match) throw new ScriptException("Invalid URL");
    const username = match[1];

    const op = [{
        operationName: "live_LiveReaderService_GetLiveInfo",
        variables: {
            params: { userName: username }
        }
    }];

    const results = callGQL(op);
    const channel = results.live_LiveReaderService_GetLiveInfo?.streamerInfo;

    if (!channel) throw new ScriptException("Channel not found");

    const socialLinks = { ...(channel.socialLinks || {}) };
    delete socialLinks.socialLinks;
    const cleanLinks = Object.fromEntries(
        Object.entries(socialLinks).filter(([_, value]) =>
            value && typeof value === 'string' && value.trim() !== ''
        )
    );

    return new PlatformChannel({
        id: new PlatformID(PLATFORM, channel.uid.toString(), plugin.config.id),
        name: channel.nickName,
        thumbnail: channel.faceUrl,
        subscribers: channel.followers || 0,
        description: channel.info || "",
        url: `${URL_CHANNEL_PREFIX}/${channel.userName}`,
        urlAlternatives: [
            `${URL_BASE}/${channel.userName}`,
            `${URL_CHANNEL_PREFIX}/${channel.userName}`
        ],
        links: cleanLinks
    });
}

source.getChannelContents = function (url, type, order, filters, continuationToken) {
    /**
     * @param url: string
     * @param type: string
     * @param order: string
     * @param filters: Map<string, Array<string>>
     * @param continuationToken: any?
     * @returns: VideoPager
     */

    const match = url.match(REGEX_USER);
    if (!match) throw new ScriptException("Invalid URL");
    const username = match[1];

    let token = continuationToken || {
        displayname: username,
        vodPage: 1,
        clipPage: 1,
        uploadPage: 1,
        vodHasMore: true,
        clipHasMore: true,
        uploadHasMore: true,
        liveFetched: false
    };

    let videos = []; // The results (PlatformVideo)

    if (!token.liveFetched) {
        const liveContent = getLiveChannelContent(username);
        if (liveContent) videos.push(liveContent);
        token.liveFetched = true;
    }

    if (token.vodHasMore) {
        const vodResult = getVodChannelContent(username, token.vodPage);
        videos = [...videos, ...vodResult.content];
        token.vodPage = vodResult.nextPage;
        token.vodHasMore = vodResult.hasMore;
    }

    // Check if clips should be included, currently is disabled by the plugin settings, and cannot be changed by the user
    if (config.shouldIncludeChannelClips) {
        if (token.clipHasMore) {
            const clipResult = getClipChannelContent(username, token.clipPage);
            videos = [...videos, ...clipResult.content];
            token.clipPage = clipResult.nextPage;
            token.clipHasMore = clipResult.hasMore;
        }
    } else {
        token.clipHasMore = false;
    }

    if (token.uploadHasMore) {
        const uploadResult = getUploadChannelContent(username, token.uploadPage);
        videos = [...videos, ...uploadResult.content];
        token.uploadPage = uploadResult.nextPage;
        token.uploadHasMore = uploadResult.hasMore;
    }

    let hasMore = token.vodHasMore || token.clipHasMore || token.uploadHasMore || false; // Are there more pages?
    const context = { url: url, type: type, order: order, filters: filters, continuationToken: token }; // Relevant data for the next page
    return new TrovoChannelVideoPager(videos, hasMore, context);
}

//Video
source.isContentDetailsUrl = function (url) {
    /**
     * @param url: string
     * @returns: boolean
     */

    return REGEX_VOD.test(url);
}

source.getContentDetails = function (url) {
    /**
     * @param url: string
     * @returns: PlatformVideoDetails
     */

    if (REGEX_VOD.test(url)) {
        return getVideoDetails(url);
    } else {
        return getLiveDetails(url);
    }
}

//Comments
source.getComments = function (url, continuationToken) {
    /**
     * @param url: string
     * @param continuationToken: any?
     * @returns: CommentPager
     */

    const match = url.match(REGEX_VOD);
    if (!match) throw new ScriptException("Invalid VOD URL");
    const videoId = match[1];

    const currentPage = continuationToken ? parseInt(continuationToken) : 1;

    const op = [{
        operationName: "public_CommentProxyService_GetCommentList",
        variables: {
            params: {
                appInfo: {
                    app: "VIDEO",
                    postID: videoId
                },
                order: "EM_COMMENT_ORDER_TYPE_VIDEO_MAIN",
                preview: {
                    order: "EM_COMMENT_ORDER_TYPE_VIDEO_SECONDARY",
                    pageSize: 0
                },
                pageSize: 20,
                page: currentPage
            }
        }
    }];

    const results = callGQL(op);

    const response = results.public_CommentProxyService_GetCommentList;

    if (!Array.isArray(response?.commentList)) {
        return new TrovoCommentPager([], false, {});
    }

    // The results (Comment)
    const comments = response.commentList.map((comment) =>
        new PlatformComment({
            contextUrl: url,
            author: new PlatformAuthorLink(
                new PlatformID(PLATFORM, comment.author.uid.toString(), plugin.config.id),
                comment.author.nickName,
                "",
                `https://headicon.trovo.live/user/${comment.author.faceUrl}`,
                0
            ),
            message: comment.content,
            rating: new RatingLikes(comment.likeNum),
            date: parseInt(comment.createdAt),
            replyCount: comment.childCommentNum,
            context: {
                commentID: comment.commentID,
                postID: videoId,
                videoUrl: url
            },
        })
    );

    const hasMore = !response.lastPage; // Are there more pages?
    const nextToken = hasMore ? currentPage + 1 : null;

    const context = { url: url, continuationToken: nextToken }; // Relevant data for the next page

    return new TrovoCommentPager(comments, hasMore, context);
}

source.getSubComments = function (comment, continuationToken) {
    /**
     * @param comment: Comment
     * @returns: TrovoSubCommentPager
     */

    if (typeof comment === 'string') {
        comment = JSON.parse(comment);
    }

    const commentID = comment.context.commentID;
    const postID = comment.context.postID;
    const videoUrl = comment.context.videoUrl;

    const currentPage = continuationToken ? parseInt(continuationToken) : 1;

    const op = [{
        operationName: "public_CommentProxyService_GetCommentById",
        variables: {
            params: {
                appInfo: {
                    app: "VIDEO",
                    postID: postID
                },
                commentID: commentID,
                order: "EM_COMMENT_ORDER_TYPE_VIDEO_SECONDARY",
                pageSize: 10,
                page: currentPage
            }
        }
    }];

    const results = callGQL(op);
    const response = results.public_CommentProxyService_GetCommentById;

    if (!Array.isArray(response?.commentList)) {
        return new TrovoSubCommentPager([], false, {});
    }

    // The results (SubComment)
    const subComments = response.commentList.map(
        (subComment) => new PlatformComment({
            contextUrl: videoUrl,
            author: new PlatformAuthorLink(
                new PlatformID(PLATFORM, subComment.author.uid.toString(), plugin.config.id),
                subComment.author.nickName,
                "",
                `https://headicon.trovo.live/user/${subComment.author.faceUrl}`,
                0
            ),
            message: subComment.content,
            rating: new RatingLikes(subComment.likeNum),
            date: parseInt(subComment.createdAt),
            replyCount: subComment.childCommentNum,
            context: {
                commentID: subComment.commentID,
                postID: postID,
                videoUrl: videoUrl
            },
        })
    );

    const hasMore = !response.lastPage; // Are there more pages?
    const nextToken = hasMore ? currentPage + 1 : null;

    const context = {
        parentContext: {
            commentID: commentID,
            postID: postID,
            videoUrl: videoUrl
        },
        continuationToken: nextToken
    }; // Relevant data for the next page

    return new TrovoSubCommentPager(subComments, hasMore, context);
};

//Live Chat
source.getLiveChatWindow = function (url) {
    const match = url.match(REGEX_USER);
    if (!match) throw new ScriptException("Invalid URL");
    const user = match[1];
    return {
        url: `${URL_LIVE_CHAT}/${user}`,
    };
}

class TrovoCommentPager extends CommentPager {
    constructor(results, hasMore, context) {
        super(results, hasMore, context);
    }

    nextPage() {
        return source.getComments(this.context.url, this.context.continuationToken);
    }
}

class TrovoSubCommentPager extends CommentPager {
    constructor(results, hasMore, context) {
        super(results, hasMore, context);
    }

    nextPage() {
        return source.getSubComments(this.context.parentComment, this.context.continuationToken);
    }
}

class TrovoHomeVideoPager extends VideoPager {
    constructor(results, hasMore, context) {
        super(results, hasMore, context);
    }

    nextPage() {
        return source.getHome(this.context.continuationToken);
    }
}

class TrovoSearchVideoPager extends VideoPager {
    constructor(results, hasMore, context) {
        super(results, hasMore, context);
    }

    nextPage() {
        return source.search(this.context.query, this.context.type, this.context.order, this.context.filters, this.context.continuationToken);
    }
}

class TrovoSearchChannelVideoPager extends VideoPager {
    constructor(results, hasMore, context) {
        super(results, hasMore, context);
    }

    nextPage() {
        return source.searchChannelContents(this.context.channelUrl, this.context.query, this.context.type, this.context.order, this.context.filters, this.context.continuationToken);
    }
}

class TrovoChannelPager extends ChannelPager {
    constructor(results, hasMore, context) {
        super(results, hasMore, context);
    }

    nextPage() {
        return source.searchChannelContents(this.context.query, this.context.continuationToken);
    }
}

class TrovoChannelVideoPager extends VideoPager {
    constructor(results, hasMore, context) {
        super(results, hasMore, context);
    }

    nextPage() {
        return source.getChannelContents(this.context.url, this.context.type, this.context.order, this.context.filters, this.context.continuationToken);
    }
}

function getLiveChannelContent(username) {
    const op = [{
        operationName: "live_LiveReaderService_GetLiveInfo",
        variables: {
            params: { userName: username }
        }
    }];

    const results = callGQL(op);
    const liveInfo = results.live_LiveReaderService_GetLiveInfo;

    if (!liveInfo || liveInfo.isLive === 0) return null;

    return new PlatformVideo({
        id: new PlatformID(PLATFORM, liveInfo.programInfo.id, plugin.config.id),
        name: liveInfo.programInfo.title,
        thumbnails: new Thumbnails([new Thumbnail(liveInfo.programInfo.coverUrl)]),
        author: new PlatformAuthorLink(
            new PlatformID(PLATFORM, liveInfo.streamerInfo.uid.toString(), plugin.config.id),
            liveInfo.streamerInfo.nickName,
            `${URL_CHANNEL_PREFIX}/${liveInfo.streamerInfo.userName}`,
            liveInfo.streamerInfo.faceUrl,
            liveInfo.channelInfo.followers || 0
        ),
        uploadDate: Math.floor(Date.now() / 1000),
        viewCount: parseFloat(liveInfo.channelInfo.viewers),
        url: `${URL_CHANNEL_PREFIX}/${liveInfo.streamerInfo.userName}`,
        isLive: true
    });
}

function getVodChannelContent(username, page) {
    const op = [{
        operationName: "vod_VodReaderService_GetChannelLtvVideoInfos",
        variables: {
            params: {
                pageSize: 15,
                currPage: page,
                terminalSpaceID: {
                    spaceName: username
                }
            }
        }
    }];

    const results = callGQL(op);
    const response = results.vod_VodReaderService_GetChannelLtvVideoInfos || {};
    const vodInfos = response.vodInfos || [];
    const streamerInfo = response.streamerInfo || {};

    const content = vodInfos.map(vod => {
        return new PlatformVideo({
            id: new PlatformID(PLATFORM, vod.vid, plugin.config.id),
            name: vod.title || "Untitled VOD",
            thumbnails: new Thumbnails([
                new Thumbnail(vod.coverUrl || streamerInfo.faceUrl)
            ]),
            author: new PlatformAuthorLink(
                new PlatformID(PLATFORM, streamerInfo.uid?.toString() || "", plugin.config.id),
                streamerInfo.nickName || username,
                `${URL_CHANNEL_PREFIX}/${streamerInfo.userName || username}`,
                streamerInfo.faceUrl,
                streamerInfo.followers || 0
            ),
            uploadDate: parseInt(vod.publishTs || "0"),
            duration: parseInt(vod.duration || "0"),
            viewCount: parseFloat(vod.watchNum || "0"),
            url: `${URL_CHANNEL_PREFIX}/${streamerInfo.userName || username}/${vod.spaceInfo?.roomID || ""}?vid=${vod.vid}`,
            isLive: false
        });
    });

    return {
        content: content,
        nextPage: page + 1,
        hasMore: response.hasMore || false
    };
}

function getClipChannelContent(username, page, filter = null) {
    const op = [{
        operationName: "vod_VodReaderService_GetChannelClipVideoInfos",
        variables: {
            params: {
                terminalSpaceID: {
                    spaceName: username
                },
                pageSize: 15,
                currPage: page,
                albumType: filter || "VOD_CLIP_ALBUM_TYPE_RECOMMENDED"
            }
        }
    }];

    const results = callGQL(op);
    const response = results.vod_VodReaderService_GetChannelClipVideoInfos || {};
    const vodInfos = response.vodInfos || [];
    const streamerInfo = response.streamerInfo || {};

    const content = vodInfos.map(vod => {
        return new PlatformVideo({
            id: new PlatformID(PLATFORM, vod.vid, plugin.config.id),
            name: vod.title || "Untitled Clip",
            thumbnails: new Thumbnails([
                new Thumbnail(vod.coverUrl || streamerInfo.faceUrl)
            ]),
            author: new PlatformAuthorLink(
                new PlatformID(PLATFORM, streamerInfo.uid?.toString() || "", plugin.config.id),
                streamerInfo.nickName || username,
                `${URL_CHANNEL_PREFIX}/${streamerInfo.userName || username}`,
                streamerInfo.faceUrl,
                streamerInfo.followers || 0
            ),
            uploadDate: parseInt(vod.publishTs || "0"),
            duration: parseInt(vod.duration || "0"),
            viewCount: parseFloat(vod.watchNum || "0"),
            url: `${URL_CHANNEL_PREFIX}/${streamerInfo.userName || username}/${vod.spaceInfo?.roomID || ""}?vid=${vod.vid}`,
            isLive: false
        });
    });

    return {
        content: content,
        nextPage: page + 1,
        hasMore: response.hasMore || false
    };
}

function getUploadChannelContent(username, page) {
    const op = [{
        operationName: "vod_VodReaderService_GetChannelUploadVideoInfos",
        variables: {
            params: {
                terminalSpaceID: {
                    spaceName: username
                },
                pageSize: 15,
                currPage: page,
                contentType: "UPLOAD"
            }
        }
    }];

    const results = callGQL(op);
    const response = results.vod_VodReaderService_GetChannelUploadVideoInfos || {};
    const vodInfos = response.vodInfos || [];
    const streamerInfo = response.streamerInfo || {};

    const content = vodInfos.map(vod => {
        return new PlatformVideo({
            id: new PlatformID(PLATFORM, vod.vid, plugin.config.id),
            name: vod.title || "Untitled Video",
            thumbnails: new Thumbnails([
                new Thumbnail(vod.coverUrl || streamerInfo.faceUrl)
            ]),
            author: new PlatformAuthorLink(
                new PlatformID(PLATFORM, streamerInfo.uid?.toString() || "", plugin.config.id),
                streamerInfo.nickName || username,
                `${URL_CHANNEL_PREFIX}/${streamerInfo.userName || username}`,
                streamerInfo.faceUrl,
                streamerInfo.followers || 0
            ),
            uploadDate: parseInt(vod.publishTs || "0"),
            duration: parseInt(vod.duration || "0"),
            viewCount: parseFloat(vod.watchNum || "0"),
            url: `${URL_CHANNEL_PREFIX}/${streamerInfo.userName || username}/${vod.spaceInfo?.roomID || ""}?vid=${vod.vid}`,
            isLive: false
        });
    });

    return {
        content: content,
        nextPage: page + 1,
        hasMore: response.hasMore || false
    };
}

function getLiveDetails(url) {
    const match = url.match(REGEX_USER);
    if (!match) throw new ScriptException("Invalid URL");
    const user = match[1];

    let op = [{
        operationName: "live_LiveReaderService_GetLiveInfo",
        variables: {
            params: { userName: user }
        }
    }]

    const results = callGQL(op);

    const liveInfo = results.live_LiveReaderService_GetLiveInfo;

    if (!liveInfo || !liveInfo.isLive) {
        throw new ScriptException("User is not live");
    }

    const live = liveInfo.programInfo;
    const streamer = liveInfo.streamerInfo;
    const channel = liveInfo.channelInfo;

    const hlsSources = [];
    const videoUrlSources = [];
    const addedTimeShiftBases = new Set();

    live.streamInfo.forEach(source => {
        if (source.playUrl) {
            videoUrlSources.push(new HLSSource({
                container: getContainerType(source.playUrl),
                codec: getCodec(source.encodeType),
                name: source.desc,
                bitrate: source.bitrate,
                url: source.playUrl.replace(".flv?", ".m3u8?"),
            }));
        }

        if (source.playTimeShiftUrl) {
            const baseUrl = source.playTimeShiftUrl.split("?")[0];
            if (!addedTimeShiftBases.has(baseUrl)) {
                hlsSources.push(new HLSSource({
                    name: `Timeshift | ${source.playTimeShiftDesc}`,
                    url: source.playTimeShiftUrl,
                    container: getContainerType(source.playTimeShiftUrl)
                }));
                addedTimeShiftBases.add(baseUrl);
            }
        }
    });

    videoUrlSources.sort((a, b) => b.bitrate - a.bitrate);

    const videoSources = [...hlsSources, ...videoUrlSources];

    return new PlatformVideoDetails({
        id: new PlatformID(PLATFORM, live.id, plugin.config.id),
        name: live.title,
        thumbnails: new Thumbnails([new Thumbnail(live.coverUrl)]),
        author: new PlatformAuthorLink(
            new PlatformID(PLATFORM, streamer.uid.toString(), plugin.config.id),
            streamer.nickName,
            `${URL_CHANNEL_PREFIX}/${streamer.userName}`,
            streamer.faceUrl,
        ),
        uploadDate: live.startTm,
        url: `${URL_CHANNEL_PREFIX}/${streamer.userName}`,
        shareUrl: `${URL_CHANNEL_PREFIX}/${streamer.userName}/${liveInfo.spaceInfo.roomID}`,
        viewCount: parseFloat(channel.viewers),

        isLive: true,
        description: `${live.description}`,
        video: new VideoSourceDescriptor(videoSources),
    })
}

function getVideoDetails(url) {
    const match = url.match(REGEX_VOD);
    if (!match) throw new ScriptException("Invalid VOD URL");
    const videoId = match[1];

    let op = [{
        "operationName": "vod_VodReaderService_BatchGetVodDetailInfo",
        "variables": {
            "params": {
                "vids": [videoId],
            }
        }
    }];

    const results = callGQL(op);
    const vodDetailsInfo = results?.vod_VodReaderService_BatchGetVodDetailInfo?.VodDetailInfos?.[videoId];

    if (!vodDetailsInfo) {
        throw new UnavailableException('Video not available');
    }

    const vodInfo = vodDetailsInfo.vodInfo || {};
    const streamerInfo = vodDetailsInfo.streamerInfo || {};

    if (vodInfo.playbackRights?.playbackRights !== 'Normal') {
        const setting = vodInfo.playbackRights?.playbackRightsSetting;
        if (setting === 'SubscriberOnly') {
            throw new ScriptException('Subscriber-only video');
        }
        throw new UnavailableException(`Video unavailable (${setting})`);
    }

    const videoSources = [];
    if (vodInfo.playInfos) {
        vodInfo.playInfos.forEach(playInfo => {
            videoSources.push(new HLSSource({
                name: playInfo.desc,
                duration: parseInt(vodInfo.duration),
                url: playInfo.playUrl,
                container: getContainerType(playInfo.playUrl)
            }));
        });
    }

    const clipInfo = vodInfo.clipInfo;
    const uploadInfo = vodInfo.uploadInfo;

    let description = vodInfo.categoryName || "";

    if (clipInfo && clipInfo.clipperUid && clipInfo.clipperUid !== 0) {
        description = `${vodInfo.categoryName}\nClipped by ${clipInfo.clipperName}`;
    }
    else if (uploadInfo && uploadInfo.uploaderUID && uploadInfo.uploaderUID !== 0) {
        description = `Uploaded by ${uploadInfo.uploaderNickName}`;
    }

    return new PlatformVideoDetails({
        id: new PlatformID(PLATFORM, vodInfo.vid, plugin.config.id),
        name: vodInfo.title,
        thumbnails: new Thumbnails([new Thumbnail(vodInfo.coverUrl)]),
        author: new PlatformAuthorLink(
            new PlatformID(PLATFORM, streamerInfo.uid.toString(), plugin.config.id),
            streamerInfo.nickName,
            `${URL_CHANNEL_PREFIX}/${streamerInfo.userName}`,
            streamerInfo.faceUrl,
            streamerInfo.followers || 0
        ),
        uploadDate: parseInt(vodInfo.publishTs),
        url: `${URL_CHANNEL_PREFIX}/${streamerInfo.userName}/${vodInfo.spaceInfo?.roomID}?vid=${vodInfo.vid}`,
        shareUrl: `${URL_CHANNEL_PREFIX}/${streamerInfo.userName}/${vodInfo.spaceInfo?.roomID}?vid=${vodInfo.vid}`,
        duration: parseInt(vodInfo.duration),
        viewCount: parseFloat(vodInfo.watchNum) || 0,
        description: description,
        video: new VideoSourceDescriptor(videoSources),
        rating: new RatingLikes(vodInfo.likeNum),
    });
}

//* Internals
function generateRandomId() {
    return [...Array(16)]
        .map(() => Math.floor(Math.random() * 16).toString(16))
        .join('');
}

/**
 * Posts to GQL_URL with the gql query. Includes relevant headers.
 * @param {string} url the url where it will be sended
 * @param {Object} gql the gql query object to be stringified and sent
 * @param {boolean} use_authenticated if true, will use the authenticated headers
 * @param {boolean} parse if true, will parse the response as json and check for errors
 * @returns {string | Object} the response body as a string or the parsed json object
 * @throws {ScriptException}

 */
function callGQL(gql, url = GQL, use_authenticated = false, parse = true) {
    const resp = http.POST(
        `${url}?qid=${generateRandomId()}`,
        JSON.stringify(gql),
        {
            Accept: '*/*',
            "Content-Type": "application/json",
            DNT: '1',
            Origin: 'https://trovo.live',
            Referer: 'https://trovo.live/',
        },
        use_authenticated
    );

    if (resp.code !== 200) {
        throw new ScriptException(`GQL returned ${resp.code}: ${resp.body}`);
    }

    if (!parse) return resp.body;

    const json = JSON.parse(resp.body);
    if (json[0]?.errors) {
        const errors = json[0].errors.map(e => e.message).join(', ');
        throw new ScriptException(`GraphQL errors: ${errors}`);
    }

    return json[0]?.data || {};
}

function getCodec(codec) {
    const codecMap = {
        VOD_ENCODE_TYPE_X264: "H.264 (x264)",
        ENCODE_TYPE_X264: "H.264 (x264)",
        ENCODE_TYPE_X265: "H.265 (x265)",
        ENCODE_TYPE_AV1: "AV1",
        ENCODE_TYPE_VP9: "VP9",
        ENCODE_TYPE_VP8: "VP8",
        ENCODE_TYPE_AVS3: "AVS3",
        ENCODE_TYPE_VVC: "VVC"
    };
    return codecMap[codec] || "Unknown";
}

function getContainerType(url) {
    if (!url) return "application/octet-stream";
    const patterns = [
        { regex: /\.mp4/i, type: "video/mp4" },
        { regex: /\.ts(\?|$)/i, type: "video/MP2T" },
        { regex: /\.flv(\?|$)/i, type: "video/x-flv" },
        { regex: /\.m3u8(\?|$)/i, type: "application/x-mpegURL" },
        { regex: /webrtc/i, type: "application/x-webrtc" },
        { regex: /quic/i, type: "application/x-quic" }
    ];
    for (const { regex, type } of patterns) {
        if (regex.test(url)) return type;
    }
    return "application/octet-stream";
}

log("LOADED");
