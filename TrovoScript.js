const BASE_GQL = "https://api.trovo.live/graphql";
const BASE_BACKUP_GQL = "https://api-backup.trovo.live/graphql";

const GQL = BASE_GQL;
const GQL_WEB = BASE_GQL.replace("api", "api-web");
const GQL_WEB_BACKUP = BASE_BACKUP_GQL.replace("api", "api-web");
const GQL_OPEN = BASE_GQL.replace("api", "open-api");

const URL_BASE = 'https://trovo.live';

const URL_CHANNEL_PREFIX = `${URL_BASE}/s`;
const URL_SEARCH = `${URL_BASE}/search?q=`;
const URL_LIVE_CHAT = `${URL_BASE}/chat`

const PLATFORM = "Trovo";

const REGEX_USER = new RegExp("^https?:\\/\\/(?:www\\.)?trovo\\.live\\/s\\/([^/?&]+)(?:[\\/#?]|$)", "i");
var config = {};

//Source Methods
source.enable = function (conf) {
    /**
     * @param conf: SourceV8PluginConfig (the TrovoConfig.js)
     */
}

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
                `${URL_CHANNEL}/${live.userInfo.userName}`,
                live.userInfo.faceUrl,
                0
            ),
            uploadDate: parseInt(live.programInfo.startTm),
            viewCount: parseFloat(live.channelInfo.viewers),
            url: `${URL_CHANNEL}/${live.userInfo.userName}`,
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
    const context = { channelUrl: channelUrl, query: query, type: type, order: order, filters: filters, continuationToken: continuationToken }; // Relevant data for the next page
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
        return new PlatformChannel({
            id: new PlatformID(PLATFORM, channel.userInfo?.uid.toString(), plugin.config.id),
            name: channel.userInfo?.nickName,
            thumbnail: channel.userInfo?.faceUrl || "",
            // banner: "",
            subscribers: channel.followers ?? 0,
            description: channel.userInfo?.info || "",
            url: `${URL_CHANNEL}/${channel.userInfo?.userName}`,
            urlAlternatives: [
                `${URL_BASE}/${channel.userInfo?.userName}`,
                `${URL_CHANNEL_PREFIX}/${channel.userInfo?.userName}`
            ],
            links: socialLinks
        });
    }); // The results (PlatformChannel)
    const hasMore = results.search_SearchService_SearchStreamers?.hasMore || false; // Are there more pages?
    const context = { query: query, continuationToken: token }; // Relevant data for the next page
    return new TrovoChannelPager(channels, hasMore, context);
};

//Channel
source.isChannelUrl = function (url) {
    /**
     * @param url: string
     * @returns: boolean
     */

    return REGEX_CHANNEL_URL.test(url);
}

source.getChannel = function (url) {
    return new PlatformChannel({
        //... see source.js for more details
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

    const videos = []; // The results (PlatformVideo)
    const hasMore = false; // Are there more pages?
    const context = { url: url, query: query, type: type, order: order, filters: filters, continuationToken: continuationToken }; // Relevant data for the next page
    return new TrovoChannelVideoPager(videos, hasMore, context);
}

//Video
source.isContentDetailsUrl = function (url) {
    /**
     * @param url: string
     * @returns: boolean
     */

    return REGEX_DETAILS_URL.test(url);
}

source.getContentDetails = function (url) {
    /**
     * @param url: string
     * @returns: PlatformVideoDetails
     */

        return getLiveDetails(url);
}

//Comments
source.getComments = function (url, continuationToken) {
    /**
     * @param url: string
     * @param continuationToken: any?
     * @returns: CommentPager
     */

    const comments = []; // The results (Comment)
    const hasMore = false; // Are there more pages?
    const context = { url: url, continuationToken: continuationToken }; // Relevant data for the next page
    return new TrovoCommentPager(comments, hasMore, context);

}
source.getSubComments = function (comment) {
    /**
     * @param comment: Comment
     * @returns: TrovoCommentPager
     */

    if (typeof comment === 'string') {
        comment = JSON.parse(comment);
    }

    return getCommentsPager(comment.context.claimId, comment.context.claimId, 1, false, comment.context.commentId);
}

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
            `${URL_CHANNEL}/${streamer.userName}`,
            streamer.faceUrl,
            // streamerInfo.followers.totalCount
        ),
        uploadDate: live.startTm,
        url: `${URL_CHANNEL}/${streamer.userName}`,

        shareUrl: `${URL_CHANNEL}/${streamer.userName}/${liveInfo.spaceInfo.roomID}`, // ?adtag=user.Username.clip

        viewCount: parseFloat(channel.viewers),

        isLive: true,
        description: `${live.description}`,
        video: new VideoSourceDescriptor(videoSources),
    })
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
            Host: 'api.trovo.live',
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
    return json;
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
