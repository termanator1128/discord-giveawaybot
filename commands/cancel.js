/**
 * cancel an active giveaway if you are admin, or if competition hasn't started yet and you created it
 *
 * Command :
 * cancel {ID}
 */
let argParser = require('minimist-string'),
    Store = require('./../lib/store'),
    codes = require('./../lib/codes'),
    recordFetch = require('./../lib/recordFetch'),
    channelProvider = require('./../lib/channelProvider'),
    Settings = require('./../lib/settings'),
    messages = require('./../lib/messages'),
    infoLog = require('./../lib/logger').info,
    hi = require('./../lib/highlight'),
    permissionHelper = require('./../lib/permissionHelper');

module.exports = async function (client, message, messageText){

    let store = await Store.instance(),
        settings = Settings.instance(),
        args = argParser(messageText);

    // merge args
    if (args.h) args.help = true;
    if (args.i) args.id = args.i;

    if (args.id){

        // ensure int
        if (isNaN(args.id)){
            message.author.send(`${hi(args.id)} is not a valid id.`);
            return codes.MESSAGE_REJECTED_INVALIDINT;
        }

        let giveaway = store.get(args.id);
        if (!giveaway){
            message.author.send(`Giveaway with id ${hi(args.id)} does not exist.`);
            return codes.MESSAGE_REJECTED_GIVEAWAYNOTFOUND;
        }

        // if user is giveaway creator or an admin, allow cancel
        let isAdmin = await permissionHelper.isAdmin(client, message.author);
        if (giveaway.ownerId !== message.author.id && !isAdmin){
            message.author.send(messages.permissionError);
            return codes.MESSAGE_REJECTED_PERMISSION;
        }

        if (giveaway.status === 'cancelled'){
            message.author.send('Cancel failed - that giveaway is already cancelled.');
            return codes.MESSAGE_REJECTED_GIVEAWAYCLOSED;
        }

        // if user is not admin, user must be owner. owners are not allowed to cancel giveaways that are already closed
        // as this wipes the game from winning history, and can be abused. only admins are allowed to do this.
        if (giveaway.status === 'closed' && !isAdmin){
            message.author.send('Cancel failed - only an admin can cancel a closed giveaway.');
            return codes.MESSAGE_REJECTED_PERMISSION;
        }

        giveaway.status = 'cancelled';
        giveaway.ended = new Date().getTime();
        store.update(giveaway);

        // find and delete giveaway message. this won't be necessary if the giveaway hasn't started yet
        let channel = channelProvider(client, settings);
        if (channel && giveaway.startMessageId) {
            let giveAwayMessage = await recordFetch.fetchMessage(channel, giveaway.startMessageId);
            if (giveAwayMessage)
                giveAwayMessage.delete();

            let urlMessage = await recordFetch.fetchMessage(channel, giveaway.urlMessageId);
            if (urlMessage)
                urlMessage.delete();
        }

        message.author.send('Giveaway cancelled.');
        infoLog.info(`User ${message.author.username} cancelled giveaway ${args.id} - ${giveaway.gameName}.`);
        return codes.MESSAGE_ACCEPTED;
    }

    if (args.help){
        message.author.send(
            `${hi('cancel')} stops an ongoing or queued giveaway. Only admins or the giveaway creator can cancel a giveaway.\n\n` +
            `Expected : ${hi('cancel --id giveawayId')} \n`+
            `Example : ${hi('cancel --id 5')} \n\n`+
            `To get a giveaway id try the ${hi('list')} command`
        );
        return codes.MESSAGE_ACCEPTED_HELPRETURNED;
    }

    message.author.send(`Invalid command. Try ${hi('cancel --help')} for more info.`);
    return codes.MESSAGE_REJECTED_INVALIDARGUMENTS;
};