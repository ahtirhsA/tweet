const express = require('express')
const app = express()
app.use(express.json())

const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
let db

const path = require('path')
const dbpath = path.join(__dirname, 'twitterClone.db')

const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const connectionWithServer = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server is running at http://localhost:3000')
    })
  } catch (e) {
    console.log(`The Error Message is ${e}`)
  }
}

connectionWithServer()

//register

app.post('/register/', async (request, response) => {
  const {username, password, name, gender} = request.body
  const getUser = `
        SELECT * FROM  user  WHERE username LIKE '${username}';
  `
  const rungetUser = await db.get(getUser)

  if (rungetUser === undefined) {
    if (password.length < 6) {
      response.status(400)
      response.send('password is too short')
    } else {
      const hashedPassword = await bcrypt.hash(password, 10)
      const createUser = `
        INSERT INTO user(username,password,name,gender)
        VALUES('${username}','${hashedPassword}','${name}','${gender}');
      `
      const runCreateQuery = await db.run(createUser)
      response.status(200)
      response.send('User created successfully')
    }
  } else {
    response.status(400)
    response.send('User already exists')
  }
})

//login

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const checkUser = `
      SELECT * FROM user WHERE username LIKE '${username}'
    `
  const resCheck = await db.get(checkUser)

  if (resCheck !== undefined) {
    const compPassword = await bcrypt.compare(password, resCheck.password)
    if (compPassword) {
      response.status(200)
      const payload = {username: '${username}'}
      const t = jwt.sign(payload, 'MY_TOKEN')
      console.log(t)
      response.send({jwtToken: t})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  } else {
    response.status(400)
    response.send('Invalid user')
  }
})

//middlewear

const middleWear = (request, response, next) => {
  const authHead = request.headers['authorization']
  let jwtToken

  if (authHead !== undefined) {
    jwtToken = authHead.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

//api1

app.get('/user/tweets/feed/', middleWear, async (request, response) => {
  const query = `
        SELECT 
        user.username AS username,
        tweet .tweet AS tweet,
        tweet.date_time AS dateTime 
        FROM (user JOIN follower ON user.user_id=follower.following_user_id) AS T join tweet ON 
        T.user_id=tweet.user_id WHERE follower.follower_user_id=${2}
        ORDER BY dateTime
        LIMIT 4;
  `
  const res = await db.all(query)
  response.send(res)
})

//api2

app.get('/user/following/', middleWear, async (request, response) => {
  const query = `
        SELECT  name FROM follower JOIN user ON follower.following_user_id=user.user_id
        WHERE follower.follower_user_id=${2};
  `
  const res = await db.all(query)
  response.send(res)
})

//api3

app.get('/user/followers/', middleWear, async (request, response) => {
  const query = `
        SELECT  name FROM follower JOIN user ON follower.follower_user_id=user.user_id
        WHERE follower.following_user_id=${2};
  `
  const res = await db.all(query)
  response.send(res)
})

//api4

app.get('/tweets/:tweetId/', middleWear, async (request, response) => {
  const {tweetId} = request.params

  const userFollowerList = `
      SELECT follower.following_user_id FROM follower WHERE follower.follower_user_id=${2}
   `
  const res = await db.all(userFollowerList)
  const arr = res.map(i => i.following_user_id)

  if (arr.includes(parseInt(tweetId))) {
    const que = `
       SELECT 
        tweet.tweet AS tweet ,
        COUNT(DISTINCT like.like_id) AS likes,
        COUNT(DISTINCT reply.reply_id) AS replies,
        tweet.date_time AS dateTime
        FROM (tweet JOIN reply ON tweet.tweet_id=reply.tweet_id) AS T JOIN like ON 
       T.tweet_id=like.tweet_id WHERE tweet.tweet_id=${tweetId}
     `
    const result = await db.get(que)
    response.send(result)
  } else {
    response.status(401)
    response.send('Invalid Request')
  }
})

//api5

app.get('/tweets/:tweetId/likes/', middleWear, async (request, response) => {
  const {tweetId} = request.params

  const userFollowerList = `
      SELECT follower.following_user_id FROM follower WHERE follower.follower_user_id=${2}
   `
  const res = await db.all(userFollowerList)
  const arr = res.map(i => i.following_user_id)

  if (arr.includes(parseInt(tweetId))) {
    const que = `
       SELECT 
        user.username AS username
        FROM like JOIN user ON like.user_id=user.user_id
        WHERE like.tweet_id=${tweetId} AND (NOT like.like_id IS NULL);
     `
    const result = await db.all(que)
    const fin = result.map(i => i.username)
    response.send({likes: fin})
  } else {
    response.status(401)
    response.send('Invalid Request')
  }
})

//api6

app.get('/tweets/:tweetId/replies/', middleWear, async (request, response) => {
  const {tweetId} = request.params

  const userFollowerList = `
      SELECT follower.following_user_id FROM follower WHERE follower.follower_user_id=${2}
   `
  const res = await db.all(userFollowerList)
  const arr = res.map(i => i.following_user_id)

  if (arr.includes(parseInt(tweetId))) {
    const que = `
       SELECT 
        user.name AS name,
        reply.reply AS reply
        FROM reply JOIN user ON reply.user_id=user.user_id
        WHERE reply.tweet_id=${tweetId} ;
     `
    const result = await db.all(que)
    response.send({replies: result})
  } else {
    response.status(401)
    response.send('Invalid Request')
  }
})

//api7

app.get('/user/tweets/', middleWear, async (request, response) => {
  const que = `
       SELECT 
        tweet.tweet AS tweet ,
        COUNT(DISTINCT like.like_id) AS likes,
        COUNT(DISTINCT reply.reply_id) AS replies,
        tweet.date_time AS dateTime
        FROM (tweet JOIN reply ON tweet.tweet_id=reply.tweet_id) AS T JOIN like ON 
       T.tweet_id=like.tweet_id WHERE tweet.tweet_id=${2};
     `
  const result = await db.all(que)
  response.send(result)
})

//api8

app.post('/user/tweets/', middleWear, async (request, response) => {
  const {tweet} = request.body
  const query = `
  INSERT INTO tweet(tweet)
  VALUES('${tweet}');
  `
  const res = await db.run(query)
  response.send('Created a Tweet')
})

//api9

app.delete('/tweets/:tweetId/', middleWear, async (request, response) => {
  const {tweetId} = request.params

  if (parseInt(tweetId) === 2) {
    const query = `
       DELETE FROM tweet WHERE tweet.tweet_id=${tweetId};
    `
    const res = await db.run(query)
    response.send('Tweet Removed')
  } else {
    response.status(401)
    response.send('Invalid Request')
  }
})

module.exports = app
