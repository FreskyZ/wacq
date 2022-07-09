# WABOT

A personal bot implementation based on [`go-cqhttp`].

This project is motivated because the chain of [`go-cqhttp`] -> [`aiocqhttp`] -> [`nonebot`] -> [`hoshinobot`] is long,
complex, hard to read and lack of documents, which may be caused by they are targeting normal
people with few programming experience, but that makes furthur development very hard, aka 'custom plugin' (not
really, the officially provided plugin also lacks document).

There exists another nodejs based bot framework [`oicqjs`], but I don't want to stop cqhttp and start again
(frequently re-login on different devices is regarded dangerous), also that framework start from the very beginning
(talk with THE server with protobuf), while I need to frequently restart the script when developing,
it is also not suitable because frequently re-login on same device should also be considered dangerous,
and I don't find document about it's plugin mechanism easily, so I'm currently not using that.

The name `wabot` is abbreviation of 'wanan bot', which means 'good night bot'.

[`go-cqhttp`]: https://github.com/Mrs4s/go-cqhttp
[`aiocqhttp`]: https://github.com/nonebot/aiocqhttp
[`nonebot`]: https://github.com/nonebot/nonebot
[`hoshinobot`]: https://github.com/Ice-Cirno/HoshinoBot
[`oicqjs`]: https://github.com/takayama-lily/oicq
