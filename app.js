const express = require("express");
const app = express();
app.use(express.json());
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const dbPath = path.join(__dirname, "twitterClone.db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Started at localhost: 3000");
    });
  } catch (e) {
    console.log(`DB ERROR: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();
module.exports = app;

// Token Authentication
const tokenAuthentication = (request, response, next) => {
  const requestHeaders = request.headers["authorization"];
  let getJwtToken;
  if (requestHeaders !== undefined) {
    getJwtToken = requestHeaders.split(" ")[1];
  }

  if (getJwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(getJwtToken, "123456789", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

// Create user API 1
app.post("/register/", async (request, response) => {
  const { name, username, password, gender } = request.body;

  const checkUserDetailsQuery = `
    SELECT username
    FROM user
    WHERE username = '${username}'`;

  const checkUserDetails = await db.get(checkUserDetailsQuery);

  if (checkUserDetails !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const createUserQuery = `
            INSERT INTO
                user(name, username, password, gender)
            VALUES 
                 (
                        '${name}',
                        '${username}',
                        '${hashedPassword}',
                        '${gender}'
                 )`;
      await db.run(createUserQuery);
      response.send("User created successfully");
    }
  }
});

// login User API 2
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  const checkUserDetailsQuery = `
    SELECT *
    FROM user
    WHERE username = '${username}'`;

  const checkUserDetails = await db.get(checkUserDetailsQuery);

  if (checkUserDetails === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const comparePassword = await bcrypt.compare(
      password,
      checkUserDetails.password
    );
    if (comparePassword === true) {
      const payLoad = { username: username };
      const jwtToken = await jwt.sign(payLoad, "123456789");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// Get Tweets API 3

app.get(
  "/user/tweets/feed/",
  tokenAuthentication,
  async (request, response) => {
    const loggedInUsername = request.username;

    const loggedInUserDetailsQuery = `
        SELECT 
            * 
        FROM 
            user 
        WHERE username = '${loggedInUsername}'`;
    const loggedInUserDetails = await db.get(loggedInUserDetailsQuery);
    console.log(loggedInUserDetails);

    const getFollowingUserQuery = `
        SELECT 
            following_user_id
        FROM 
           follower
        WHERE
            follower_user_id = ${loggedInUserDetails.user_id} `;
    const followingUserDetails = await db.all(getFollowingUserQuery);
    console.log(followingUserDetails);

    let res = [];

    for (let user of followingUserDetails) {
      let followingUserId = user.following_user_id;
      const getTweetsQuery = `
        SELECT 
            username, tweet, date_time as dateTime
        FROM 
            user NATURAL JOIN tweet
        WHERE
            user_id = ${followingUserId}
        ORDER BY
            user_id
        LIMIT 2
        OFFSET 0`;
      const tweetResult = await db.all(getTweetsQuery);

      for (let item of tweetResult) {
        res.push(item);
      }
    }
    response.send(res);
  }
);

// Get user following Names API 4
app.get("/user/following/", tokenAuthentication, async (request, response) => {
  const loggedUsername = request.username;

  const loggedInUserDetailsQuery = `
        SELECT 
            * 
        FROM 
            user 
        WHERE username = '${loggedUsername}'`;
  const loggedInUserDetails = await db.get(loggedInUserDetailsQuery);

  const getFollowingUserQuery = `
        SELECT 
            following_user_id
        FROM 
           follower
        WHERE
            follower_user_id = ${loggedInUserDetails.user_id} `;
  const followingUserDetails = await db.all(getFollowingUserQuery);

  res = [];

  for (let Id of followingUserDetails) {
    let userId = Id.following_user_id;
    const query = `
          SELECT name FROM user WHERE user_id = ${userId}`;
    const result = await db.get(query);
    res.push(result);
  }
  response.send(res);
});

// get Followers API 5
app.get("/user/followers/", tokenAuthentication, async (request, response) => {
  const loggedUsername = request.username;

  const loggedInUserDetailsQuery = `
        SELECT 
            * 
        FROM 
            user 
        WHERE username = '${loggedUsername}'`;
  const loggedInUserDetails = await db.get(loggedInUserDetailsQuery);

  const getFollowersQuery = `
        SELECT 
            follower_user_id
        FROM 
           follower
        WHERE
            following_user_id = ${loggedInUserDetails.user_id} `;
  const followersDetails = await db.all(getFollowersQuery);

  res = [];

  for (let Id of followersDetails) {
    let userId = Id.follower_user_id;
    const query = `
          SELECT name FROM user WHERE user_id = ${userId}`;
    const result = await db.get(query);
    res.push(result);
  }
  response.send(res);
});

// Get Tweets whom the user follows 6
app.get("/tweets/:tweetId/", tokenAuthentication, async (request, response) => {
  const loggedUsername = request.username;

  const { tweetId } = request.params;

  const loggedInUserDetailsQuery = `
        SELECT 
            * 
        FROM 
            user 
        WHERE username = '${loggedUsername}'`;
  const loggedInUserDetails = await db.get(loggedInUserDetailsQuery);

  const getFollowingUserQuery = `
        SELECT 
            following_user_id
        FROM 
           follower
        WHERE
            follower_user_id = ${loggedInUserDetails.user_id} `;
  const followingUserDetails = await db.all(getFollowingUserQuery);

  followingUserIds = [];
  for (let Ids of followingUserDetails) {
    followingUserIds.push(Ids.following_user_id);
  }

  const getTweetQuery = `
  SELECT * FROM tweet WHERE tweet_id = ${tweetId}`;

  const tweetResult = await db.get(getTweetQuery);

  if (followingUserIds.includes(tweetResult.user_id)) {
    const getLikeCountQuery = `
            SELECT 
                count(like_id) as likes
            FROM 
                like
            WHERE
                tweet_id = ${tweetId}`;
    const likeCount = await db.all(getLikeCountQuery);
    console.log(likeCount);
    const getReplyCountQuery = `
            SELECT 
                count(reply_id) as replies
            FROM 
                reply
            WHERE
                tweet_id = ${tweetId}`;
    const replyCount = await db.all(getReplyCountQuery);

    const tweet = tweetResult.tweet;
    const dateTime = tweetResult.date_time;

    response.send({
      tweet: tweet,
      likes: likeCount[0].likes,
      replies: replyCount[0].replies,
      dateTime: dateTime,
    });
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

// Get UserNames from like Table 7
app.get(
  "/tweets/:tweetId/likes/",
  tokenAuthentication,
  async (request, response) => {
    const loggedUsername = request.username;

    const { tweetId } = request.params;

    const loggedInUserDetailsQuery = `
        SELECT 
            * 
        FROM 
            user 
        WHERE username = '${loggedUsername}'`;

    const loggedInUserDetails = await db.get(loggedInUserDetailsQuery);
    console.log(loggedInUserDetails);

    const getFollowingUserQuery = `
        SELECT 
            following_user_id
        FROM 
           follower
        WHERE
            follower_user_id = ${loggedInUserDetails.user_id} `;
    const followingUserDetails = await db.all(getFollowingUserQuery);
    console.log(followingUserDetails);

    followingUserIds = [];

    for (let Ids of followingUserDetails) {
      followingUserIds.push(Ids.following_user_id);
    }
    console.log(followingUserIds);

    const getTweetQuery = `
    SELECT * FROM tweet WHERE tweet_id = ${tweetId}`;

    const tweetResult = await db.get(getTweetQuery);
    console.log(tweetResult);

    if (followingUserIds.includes(tweetResult.user_id)) {
      const res = [];
      const getNamesWhoLikedQuery = `
        SELECT
            username as likes
        FROM 
            like INNER JOIN user ON like.user_id = user.user_id
        WHERE
            like.tweet_id = ${tweetId}`;
      const namesResult = await db.all(getNamesWhoLikedQuery);

      for (let item of namesResult) {
        res.push(item.likes);
      }

      response.send({
        likes: res,
      });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

// Get Replies API 8
app.get(
  "/tweets/:tweetId/replies/",
  tokenAuthentication,
  async (request, response) => {
    const loggedUsername = request.username;

    const { tweetId } = request.params;

    const loggedInUserDetailsQuery = `
        SELECT 
            * 
        FROM 
            user 
        WHERE username = '${loggedUsername}'`;

    const loggedInUserDetails = await db.get(loggedInUserDetailsQuery);

    const getFollowingUserQuery = `
        SELECT 
            following_user_id
        FROM 
           follower
        WHERE
            follower_user_id = ${loggedInUserDetails.user_id} `;
    const followingUserDetails = await db.all(getFollowingUserQuery);

    followingUserIds = [];
    for (let Ids of followingUserDetails) {
      followingUserIds.push(Ids.following_user_id);
    }
    console.log(followingUserIds);
    const getTweetQuery = `
    SELECT * FROM tweet WHERE tweet_id = ${tweetId}`;

    const tweetResult = await db.get(getTweetQuery);
    console.log(tweetResult);

    if (followingUserIds.includes(tweetResult.user_id)) {
      const getRepliesQuery = `
        SELECT
            user.name, reply
        FROM 
            reply NATURAL JOIN user
        WHERE
            reply.tweet_id = ${tweetId}`;
      const repliesResult = await db.all(getRepliesQuery);
      console.log(repliesResult);
      response.send({
        replies: repliesResult,
      });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

// Get Tweets of User 9
app.get("/user/tweets/", tokenAuthentication, async (request, response) => {
  const loggedUsername = request.username;

  const loggedInUserDetailsQuery = `
        SELECT 
            * 
        FROM 
            user 
        WHERE username = '${loggedUsername}'`;

  const loggedInUserDetails = await db.get(loggedInUserDetailsQuery);
  console.log(loggedInUserDetails);

  const getTweetsQuery = `
  SELECT 
        tweet,
        tweet_id,
        date_time as dateTime
    FROM
        tweet
    WHERE
        user_id = ${loggedInUserDetails.user_id}`;
  const tweets = await db.all(getTweetsQuery);
  console.log(tweets);

  const tweetIds = [];
  for (let item of tweets) {
    tweetIds.push(item.tweet_id);
  }
  console.log(tweetIds);

  const likes = [];

  for (let id of tweetIds) {
    const getLikesCount = `
        SELECT 
            count(like_id) as likes
        FROM 
            like
        WHERE
            tweet_id = ${id}`;
    const res = await db.all(getLikesCount);
    likes.push(res[0]);
  }
  console.log(likes);

  const replies = [];

  for (let id of tweetIds) {
    const getRepliesCount = `
      SELECT
        count(reply) as replies
    FROM 
        reply
    WHERE
        tweet_id = ${id}`;
    const res = await db.all(getRepliesCount);
    replies.push(res[0]);
  }
  console.log(replies);

  const result = [];
  let count = 0;
  for (let item of tweets) {
    result.push({
      tweet: item.tweet,
      likes: likes[count].likes,
      replies: replies[count].replies,
      dateTime: item.dateTime,
    });
    count += 1;
  }
  console.log(result);
  response.send(result);
});

// Create Tweet API 10
app.post("/user/tweets/", tokenAuthentication, async (request, response) => {
  const loggedUsername = request.username;

  const { tweet } = request.body;

  const loggedInUserDetailsQuery = `
        SELECT 
            * 
        FROM 
            user 
        WHERE username = '${loggedUsername}'`;

  const loggedInUserDetails = await db.get(loggedInUserDetailsQuery);
  console.log(loggedInUserDetails);

  const createTweetQuery = `
  INSERT INTO
  tweet(tweet, user_id)
  VALUES (
      '${tweet}',
      ${loggedInUserDetails.user_id}
  )`;
  await db.run(createTweetQuery);
  response.send("Created a Tweet");
});

// Delete Twee APi 11
app.delete(
  "/tweets/:tweetId/",
  tokenAuthentication,
  async (request, response) => {
    const loggedUsername = request.username;

    const { tweetId } = request.params;

    const loggedInUserDetailsQuery = `
        SELECT 
            user_id
        FROM 
            user 
        WHERE username = '${loggedUsername}'`;

    const loggedInUserId = await db.get(loggedInUserDetailsQuery);
    console.log(loggedInUserId);

    const getTweetDetails = `
    SELECT
        user_id
    FROM 
        tweet
    WHERE
        tweet_id = ${tweetId}`;
    const userId = await db.get(getTweetDetails);
    console.log(userId);

    if (loggedInUserId.user_id === userId.user_id) {
      const deleteTweetQuery = `
        DELETE
        FROM
            tweet
        WHERE tweet_id = ${tweetId}`;
      await db.run(deleteTweetQuery);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);
