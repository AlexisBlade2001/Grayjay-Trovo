# Trovo Plugin for Grayjay
Hi, here I am again with an attempt to add a new source for [Grayjay](https://grayjay.app/), this time is [Trovo](https://trovo.live/)
So, for context, I learned about this platform after the rebranding of it?(it was a rebranding or was it the purchase from Tencent) when they were in a beta phase, I saw some people try it (people I followed) but it just felt weird somehow, not in the sense of _Booo, this is so broken_ but instead it was something else I can't pinpoint.

While I forgot that this one existed, It also made me think on the possibility of creating a plugin for it, I'm gonna be honest, I'm just rewriting the script with parts of the DLive's one, If that thing is working, well let's keep going with it.

While inspecting sources, I learned something called **Progressive Download HTTP Streaming**, and... yeah, that was something I didn't knew about. does Grayjay support this style of streaming? or there's another solution for this case?

Also... sorry for having A LOT of Allowed URLs, I don't know what urls are being used, I just grabbed everything I found on both DevTools Network's and Sources Tab

## Functionality
 - [ ] Authentication
   - [ ] Import Subscriptions
 - [ ] Home
   - [ ] HomePager
 - [x] Search
   - [x] Suggestions
   - [x] Content
     - [x] ContentPager
   - [x] Channel
     - [x] ChannelPager
 - [x] Channel
   - [x] Profile
     - [x] Name
     - [x] Photo
     - [ ] Banner
     - [ ] Subscribers
     - [x] Description
     - [x] URL
       - [x] Alternatives
     - [x] Links
   - [x] Content Listing
     - [x] Lives
     - [x] Replays / VODs
     - [x] Videos
     - [x] Clips
 - [ ] Content
   - [ ] Live Streams
     - [x] Title
     - [x] Thumbnail
     - [x] Author
     - [x] Upload Date
     - [x] URL
     - [x] View Count
     - [x] Description
     - [ ] Video Sources
       - [ ] Quality Options
     - [x] Live Chat / Events
       - [ ] Native Implementation
       - [x] WebView Implementation
   - [x] Replay / VOD
     - [x] Title
     - [x] Thumbnail
     - [x] Author
     - [x] Upload Date
     - [x] URL
     - [x] Duration
     - [x] View Count
     - [x] Description
     - [x] Video Sources
       - [x] Quality Options
     - [x] Comments
       - [x] Subcomments
         - [x] SubcommentPager
       - [x] CommentPager
     - [x] Ratings
   - [x] Video
     - [x] Title
     - [x] Thumbnail
     - [x] Author
     - [x] Upload Date
     - [x] URL
     - [x] Duration
     - [x] View Count
     - [x] Video Sources
       - [x] Quality Options
     - [x] Comments
       - [x] Subcomments
         - [x] SubcommentPager
       - [x] CommentPager
     - [x] Ratings
   - [x] Clip
     - [x] Title
     - [x] Thumbnail
     - [x] Author
     - [x] Upload Date
     - [x] URL
     - [x] Duration
     - [x] View Count
     - [x] Video Sources
       - [x] Quality Options
     - [x] Comments
       - [x] Subcomments
         - [x] SubcommentPager
       - [x] CommentPager
     - [x] Ratings

## What TO-DO / FIX
Well, this was certainly fast to find things, but we still have missing some things
- [ ] Implement search filters
- [ ] Import following list (can it also be Subscriptions?)
- [ ] Fix Homepage
- [ ] Fix Authentication
- [ ] Fix Livestream VideoSources
- [ ] Fix Followers Count

for Comments (even though those don't seem to be used in any way)
- [ ] Find a way to get the user's url
- [ ] Find a way to get the user's follower count
- [ ] Check if Comments/Subcomments pagers are really working and not a fluke