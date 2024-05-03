# WACQ

A chat client implementation for a famous chat software in a large country.

STATUS UPDATE: the underlying communicating service provider stops working,
new service provider is being seeked and tried, that require a lot of work,
the development of this project will be blocked for very long time

## Features

- web based ui, clean and does not occupy mobile device storage space
- message archive
- plugin framework with hot reload support

#### More on 'message archive'

This is as simple as store all message to database and use later, but also a very profound topic. I mean, I have
lost like 99.99% of the message record using this chat software and another chat software by the same company,
especially message records from the days I have hundreds of private messages per day and 
tens of thousands of messages per month in my 20s, I probably will never make this amount of private message records
in remaining of my lifetime, but I still want to implement this feature, as a major achivement in my personal toy 
software life. I assume the probability of seeing this year (2022)'s message record in an official client
after 10 years is less than 0.01% and the chance of able to viewing this year's message in this software,
or at least in this database will be at least 60%, which will be really interesting and meaningful at that age.

## Motivation

This project is mainly motivated by the poor implementation of the original official client (both pc and mobile device).

This project is also motivated by the difficulty to devlopment using the common bot software [`hoshinobot`],
which is complex, hard to read and really lacks document. The architecture of [`nonebot`] + [`hoshinobot`] is
confusing, nonebot is already a bot framework with plugin management, command concept and even natural language
processing, but hoshinobot still claim itself as a bot *software* but not a *plugin* (or plugin set) of nonbot.
It has its own plugin framework and many more concepts, if this is to hide the underlying nonebot from end user, then
the requirement to setup go-cqhttp still makes installation process complex and nervous for new users. The
duplication of api and event list from [`go-cqhttp`] through [`aiocqhttp`] and then nonebot and 
hoshinobot make their own remaining documents even fewer, while on the other hand, hoshinobot's builtin plugins
have NO document at all. It seems that a lot of inexperienced users are using this bot software, but this designment
or architecture choices does not actually help them but only make both inexperienced and experienced users confuse.

There exists another nodejs based bot framework [`oicqjs`], but I don't want to stop cqhttp and start again
(frequently re-login on different devices is regarded dangerous), also that framework start from the very beginning
(talk with THE server with protobuf), while I need to frequently restart the script when developing,
it is also not suitable because frequently re-login on same device should also be considered dangerous,
and I don't find document about it's plugin mechanism easily, so I'm currently not using that.

> The name `wacq` is a combination of 'wa' and 'cq',
  'cq' is the common postfix of this series of chat software, 'wa' is abbreviation of 'wanan', which means 'good night'.

[`go-cqhttp`]: https://github.com/Mrs4s/go-cqhttp
[`aiocqhttp`]: https://github.com/nonebot/aiocqhttp
[`nonebot`]: https://github.com/nonebot/nonebot
[`hoshinobot`]: https://github.com/Ice-Cirno/HoshinoBot
[`oicqjs`]: https://github.com/takayama-lily/oicq
