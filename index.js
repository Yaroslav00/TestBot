var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var path = require('path');
var fs = require('fs');
const request = require('request');
// Assign credentials for binance api
const binance = require('node-binance-api')().options({
    APIKEY: 'vmPUZE6mv9SD5VNHk4HlWFsOr6aKE2zvsw0MuIgwCIPy6utIco14y7Ju91duEh8A',
    APISECRET: 'NhqPtmdSJYdKjVHjA7PZj4Mge3R5YNiP1e3UZjInClVN65XAbvqqM6A7H5fATj0j',
    useServerTime: true
});
// This app works this way:
// When user presses Start Bot button, the bot starts checking the situation on market
// It analyses last 15  one minute candles: if the highest point for the last 15 minutes is higher then current price level
// on at least 100$, then bot gives a signal in console that user should prepare to trade. User should wait until the price
// confirms its reverse with confirmation candle(1m bull candle). After it happens, bot gives us a signal to trade.
// Takeprofit level is set on the local maximum level and stoploss is set on the level which lower then current price
// on 3*(takeprofit - current price) points.
// When the price reaches takeprofit or stoploss level, bot gives a signal to sell.

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.use(express.static('public'));
app.use(express.urlencoded());
app.use(express.json());
// ready variable is assigned with true when the price drops on 100$
var ready = false;
// bought variable is assigned with true when the user should buy
var bought = false;
var take_profit, stop_loss;

// This bot works on 3000 port
// Start listening 3000 port
app.listen(3000, function () {
    console.log('Bot works');
});
// Rendering start page
app.get('/', function (req, res) {

    res.render('start');

});

// The bot starts working
app.post('/start_bot', function (req, res) {
    // Every second bot receive information about the currency BTCUSDT
    binance.websockets.chart("BTCUSDT", "1m", (symbol, interval, chart) => {
        //
        if( !ready && !bought) {
            console.clear();
            console.log("Waiting for signal");
            let tick = binance.last(chart);
            // Current price
            let last = chart[tick].close;
            // An array of price which contains the history of the last 500 candles. Unfortunetly, we can't set a limit
            // of candles in this method.
            let ohlc = binance.ohlc(chart);

            // In the next raw bot decides if it should give a signal to prepare
            if (Math.max(...ohlc['high'].slice(485, 500)) - last >= 100) {
                // Set take profit and stop loss
                take_profit = Math.max(...ohlc['high'].slice(485, 500));
                stop_loss = last - (Math.max(...ohlc['high'].slice(485, 500))-last);
                console.log("!!!!!!!!!!!!!!PREAPARE TO TRADE!!!!!!!!!!!!!!PREAPARE TO TRADE!!!!!!!!!!!!!PREAPARE TO TRADE!!!!!!!!!!!!!!PREAPARE TO TRADE!!!!!!!!!!!!!!!!!!");
                ready = true;
            }
        }
        // If ready but hasn't already bought...
        else if (!bought)
        {
            let tick = binance.last(chart);
            const last = chart[tick].close;

            let ohlc = binance.ohlc(chart);
            // Check if previous candle confirm reverse or not
            if(ohlc['close'][498]>ohlc['open'][498])
            {
                // If yes then ..
                console.log("!!!!!!!!!!!!!!BUY!!!!!!!!!!!!!!BUY!!!!!!!!!!!!!BUY!!!!!!!!!!!!!!BUY!!!!!!!!!!!!!!!!!!");
                ready = false;
                bought = true;
            }
        }
        // If user has already bought, he waits for signal to sell
        if (bought)
        {
            let tick = binance.last(chart);
            const last = chart[tick].close;

            let ohlc = binance.ohlc(chart);

            // Price reaches take profit
            if(ohlc['close'][499] > take_profit)
            {
                console.log("!!!!!!!!!!!!!!SELL!!!!!!!!!!!!!!SELL!!!!!!!!!!!!!SELL!!!!!!!!!!!!!!SELL!!!!!!!!!!!!!!!!!!");

                bought = false;
            }
            // Price reaches stop loss
            else if(ohlc['close'][499] < stop_loss)
            {
                console.log("!!!!!!!!!!!!!!SELL!!!!!!!!!!!!!!SELL!!!!!!!!!!!!!SELL!!!!!!!!!!!!!!SELL!!!!!!!!!!!!!!!!!!");

                bought = false;
            }
        }

    });
    res.render('start');
});



// The next part of program is about testing the bot
// You can set the time range of testing on the web page
// This functions starts working when user press Start backtesting button
async function test(start,finish){
    // Current profit
    var profit = 0;
    // Current time(historical)
    var current_time = start;
    // Equivalent values (just like in the previous part) for each currency
    var ready = {"BTCUSDT":false, "BNBUSDT":false};
    var bought = {"BTCUSDT":false, "BNBUSDT":false};
    var take_profit ={"BTCUSDT":0, "BNBUSDT":0};
    var stop_loss = {"BTCUSDT":0, "BNBUSDT":0};
    // Price of the currency when the user buy
    var ask_price={"BTCUSDT":0, "BNBUSDT":0};
    // Start write the file
    fs.writeFile('backtest.txt', 'Date of trade' +'\t'+  'Currency'+ '\t' +
        'Purchase price'+'\t'+'Selling price'+'\t'+ 'Profit', function (err) {
            if (err) throw err;
          });
    // Going through historical data since the start timestamp till the finish timestamp
    while(current_time < finish)
    {
        // Another problem is the limit of historical candles equals 500 per one request
        // As long as we work with 1m candles, it means that bot should make 3 request per day
        // That is the main reason of high   'time complexity'    of backtesting in this case
        var list_of_candles_btc_usdt= [];
        var list_of_candles_bnb_usdt= [];

        // I use promises to wait until request is done. It usually takes up to 1 second
        let promise = new Promise(function(resolve, reject) {
            binance.candlesticks("BTCUSDT", "1m", (error, ticks, symbol) => {

                resolve(ticks);

            }, {limit: 500, startTime: current_time});
        });
        await promise.then(function (result) {

            list_of_candles_btc_usdt = result;

        });

        let promise_bnb_usd = new Promise(function(resolve, reject) {
            binance.candlesticks("BNBUSDT", "1m", (error, ticks, symbol) => {

                resolve(ticks);

            }, {limit: 500, startTime: current_time});
        });
        await promise_bnb_usd.then(function (result) {

            list_of_candles_bnb_usdt = result;

        });


        // Start analysing current 500 candles
        for (var i =15; i < list_of_candles_btc_usdt.length; i++ )
        {
            console.clear();
            console.log(profit);
            var date = new Date(current_time);
            console.log(date);

            let highest_points = [];
            if( !ready.BTCUSDT && !bought.BTCUSDT && current_time < finish) {
                let highest_point,current_candle_close;

                for (let j = i-15; j < i+1; j++)
                {

                    highest_points.push(parseFloat(list_of_candles_btc_usdt[j][2]));
                }

                current_candle_close = list_of_candles_btc_usdt[i][4];
                highest_point = Math.max(...highest_points);

                if(highest_point - current_candle_close >=100)
                {

                    ready.BTCUSDT = true;
                    take_profit.BTCUSDT = highest_point;
                    stop_loss.BTCUSDT = current_candle_close - 3*(highest_point-current_candle_close);
                    // Searching the highest point during the last 15 minutes
                    for (let j= i-15; j < i+1; j++)
                    {

                        highest_points.push(parseFloat(list_of_candles_bnb_usdt[j][2]));
                    }

                    current_candle_close = list_of_candles_bnb_usdt[i][4];
                    highest_point = Math.max(...highest_points);
                    // When the price meet our conditions, we also analise the situation on BNBUSDT market
                    // and buy currency if needed
                    if(highest_point - current_candle_close >=100 && !ready.BNBUSDT && !bought.BNBUSDT) {
                        ready.BNBUSDT = true;
                        take_profit.BNBUSDT = highest_point;
                        stop_loss.BNBUSDT = current_candle_close - 3 * (highest_point - current_candle_close);
                    }

                    
                    
                }



            }


            // Waiting for signals

            if(ready.BTCUSDT && !bought.BTCUSDT && current_time < finish) {



                let previous_close = parseFloat(list_of_candles_btc_usdt[i-1][4]);
                let previous_open = parseFloat(list_of_candles_btc_usdt[i-1][1]);
                if (previous_close>previous_open)
                {
                    ask_price.BTCUSDT  = list_of_candles_btc_usdt[i][1];
                    bought.BTCUSDT = true;
                    ready.BTCUSDT = false;
                }



            }
            if(bought.BTCUSDT && current_time < finish) {

                let previous_close = parseFloat(list_of_candles_btc_usdt[i][4]);
                let previous_open = parseFloat(list_of_candles_btc_usdt[i][1]);
                if (previous_close > take_profit.BTCUSDT)
                {
                    bought.BTCUSDT = false;
                    let previous_profit = profit;
                    profit += 1000*(previous_close - ask_price.BTCUSDT);
                    let date1 = new Date(current_time);
                    // Write results of trade to the file
                    fs.appendFile('backtest.txt', date1.toDateString() +'\t'+"BTCUSDT" +'\t'+ ask_price.BTCUSDT + '\t'+ previous_close + '\t'+ ((profit - previous_profit)*100/1000).toString() + '%' +'\n', function (err) {
                        if (err)
                            console.log(err);

                    });
                }
                else if(previous_close < stop_loss.BTCUSDT)
                {
                    bought.BTCUSDT = false;
                    profit += 1000*(previous_close - ask_price.BTCUSDT);
                }



            }


            if(ready.BNBUSDT && !bought.BNBUSDT && current_time < finish) {



                let previous_close = parseFloat(list_of_candles_bnb_usdt[i-1][4]);
                let previous_open = parseFloat(list_of_candles_bnb_usdt[i-1][1]);
                if (previous_close>previous_open)
                {
                    ask_price.BNBUSDT  = list_of_candles_bnb_usdt[i][1];
                    bought.BNBUSDT = true;
                    ready.BNBUSDT = false;
                }



            }

            if(bought.BNBUSDT && current_time < finish) {

                let previous_close = parseFloat(list_of_candles_bnb_usdt[i-1][4]);
                let previous_open = parseFloat(list_of_candles_bnb_usdt[i- 1][1]);

                if (previous_close > take_profit.BNBUSDT)
                {
                    bought.BNBUSDT = false;
                    let previous_profit = profit;
                    profit += 1000*(previous_close - ask_price.BNBUSDT);
                    let date1 = new Date(current_time);
                    // Write results of trade to the file
                    fs.appendFile('backtest.txt', date1.toDateString() +'\t'+"BNBUSDT"+'\t'+ ask_price.BNBUSDT + '\t'+ previous_close +'\t'+ ((profit - previous_profit)*100/1000).toString() + '%'+'\n', function (err) {
                        if (err)
                            console.log(err);

                    });
                }
                else if(previous_close < stop_loss.BNBUSDT)
                {
                    bought.BNBUSDT = false;
                    profit += 1000*(previous_close - ask_price.BNBUSDT);
                }



            }


            // Increasing current time with 1 minute
            current_time+=60000;





        }


    }
    console.log("Backtesting finished");
}
// Dealing with post request
app.post('/', function (req,res) {

    let dateFrom = (new Date(req.body.from)).getTime();
    let dateTo = (new Date(req.body.To)).getTime();
    console.log(1);

    test(dateFrom
        ,dateTo);

    res.render('start');


});
