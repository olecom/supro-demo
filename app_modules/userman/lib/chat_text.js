//`new Function(...){`
if(local.log_dir){
    api_text(ret, api, local, req, res, next)
} else {// directoty is not ready
    setTimeout(api_text, 1024, ret, api, local, req, res, next)
}
return true// async anyway
//`}`

/*
 * Event(s):
 *   broadcast: 'chatmsg@um'
 *
 * Developed, tested, debugged using reload `view.Window` tool button
 **/

function api_text(ret, api, local, req, res, next){
var d, f
    if(!local.log_dir){
        throw new Error('Chat: no `log_dir` available')// handled by `connect`
    }

    if('GET' == req.method && req.url.query.file){
    //'http://localhost:3007/um/lib/chat/text?file=2014-07'
        /* lame direct eating memory way :
         *fs.readFile(local.log_dir + '/' + req.url.query.file + '.txt',
         *   function (err, data){
         *       if(err) throw new Error(err)
         *       res.txt(data)
         *   }
        )*/
        api.connect.sendFile(
            local.log_dir + '/' + req.url.query.file + '.txt', true
        )(req, res)// call middleware
        return
    }
    // POST `req.txt`: <olecom>{\t}a simple chat message. (with some html around)
    //'http://localhost:3007/um/lib/chat/text'

    d = new Date()
    f = '/' + d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '.txt'
    if(f != local.log_file_name){// new date, new file
        local.log_file_name = f
        if(local.log_file){// current log file is opened
            local.log_file.end(null,
                function on_close_log_file(err){
                    if(err) next(new Error(err))
                    open_log()
                }
            )
        } else {
            open_log()
        }
    }
    append_log()
    return

    function open_log(){
        local.log_file = local.require.fs.createWriteStream(
            local.log_dir + local.log_file_name,
            { flags: 'a+' }// read && append
        )

        local.log_file.on('error',
            function on_error_log_file(err){
                if(err) next(new Error(err))
                local.log_file.end()
                local.log_file = null
            }
        )
    }

    function append_log(){// limit is '4mb' in `app_main\lib\middleware\postTextPlain.js`
    var msg = JSON.stringify(req.json) + '\n'
        api.wes.broadcast('chatmsg@um', msg)
        local.log_file.write('{"d":"' + d.toISOString() + '",' + msg.slice(1))
        ret.success = true
        res.json(ret)
    }

    function pad(n){
        return n < 10 ? '0' + n : n
    }
}
