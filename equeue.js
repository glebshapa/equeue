import { Telegraf, Markup } from 'telegraf';
import config from './config.js';
import { User, Dish, Order } from './models.js';

const bot = new Telegraf(config.bot.token);

const callbackButton = Markup.button.callback;
const urlButton = Markup.button.url;

const adminMainKB = Markup.keyboard([
    '☑️ Наличие блюд',
]).resize();

const mainKB = Markup.keyboard([
    '🍽 Сделать заказ'
]).resize();

const orderMenuKB = (orderId) => Markup.inlineKeyboard([
    [callbackButton(`➕ Добавить блюдо`, `addDishInOrder:${orderId}`)],
    [callbackButton(`➖ Удалить блюдо`, `deleteDishInOrder:${orderId}`)],
    [callbackButton(`❌ Отменить заказ`, `cancelOrder:${orderId}`)],
    [callbackButton(`✅ Попросить выдать заказ`, `finishOrder:${orderId}`)],
]).resize();

const chooseDishCategoryKB = (orderId) => Markup.inlineKeyboard([
    [callbackButton(`🥤 Напитки`, `chooseDishCategory:0:${orderId}`)],
    [callbackButton(`🥗 Салаты`, `chooseDishCategory:1:${orderId}`)],
    [callbackButton(`🍜 Супы`, `chooseDishCategory:2:${orderId}`)],
    [callbackButton(`🥩 Горячее`, `chooseDishCategory:3:${orderId}`)],
    [callbackButton(`🍚 Гарниры`, `chooseDishCategory:4:${orderId}`)],
    [callbackButton(`🍞 Хлебобулочное`, `chooseDishCategory:5:${orderId}`)],
    [callbackButton(`🍫 Прочее`, `chooseDishCategory:6:${orderId}`)],
    [callbackButton(`◀️ Вернуться к заказу`, `backInOrderMenu:${orderId}`)],
    
]).resize();

const chooseDishKB = (orderId, dishes) => {
    let dishesButtons = dishes.map(dish => [callbackButton(`🔹 ${dish.name} - ${dish.weight}г - ${dish.cost}р`, `addDish:${orderId}:${dish.id}`)]);
    dishesButtons.push([callbackButton(`◀️ Вернуться к заказу`, `backInOrderMenu:${orderId}`)]);

    return Markup.inlineKeyboard(dishesButtons).resize();
};

const deleteDishKB = async (orderId) => {
    let order = await Order.findOne({id: orderId});

    let dishesButtons = order.dishIds.map(async (dishId, ind) => { let dish = await Dish.findOne({id: dishId}); return [callbackButton(`🔹 ${dish.name} - ${dish.weight}г - ${dish.cost}р`, `deleteDish:${orderId}:${ind}`)]; });
    for (let i in dishesButtons)
        dishesButtons[i] = await dishesButtons[i];

    dishesButtons.push([callbackButton(`◀️ Вернуться к заказу`, `backInOrderMenu:${orderId}`)]);

    return Markup.inlineKeyboard(dishesButtons).resize();

}

const cancelFinishKB = (orderId) => Markup.inlineKeyboard([
    [callbackButton(`◀️ Вернуться к заказу`, `backInOrderMenu:${orderId}`)],
]).resize();

const chooseDishCategoryInStockKB = Markup.inlineKeyboard([
    [callbackButton(`🥤 Напитки`, `chooseDishCategoryInStock:0`)],
    [callbackButton(`🥗 Салаты`, `chooseDishCategoryInStock:1`)],
    [callbackButton(`🍜 Супы`, `chooseDishCategoryInStock:2`)],
    [callbackButton(`🥩 Горячее`, `chooseDishCategoryInStock:3`)],
    [callbackButton(`🍚 Гарниры`, `chooseDishCategoryInStock:4`)],
    [callbackButton(`🍞 Хлебобулочное`, `chooseDishCategoryInStock:5`)],
    [callbackButton(`🍫 Прочее`, `chooseDishCategoryInStock:6`)],
]).resize();

const chooseDishInStockKB = (dishCategory, dishes) => {
    let dishesButtons = dishes.map(dish => [callbackButton(`${dish.inStock ? '🟢' : '🔴'} ${dish.name} - ${dish.weight}г - ${dish.cost}р`, `changeInStockDish:${dishCategory}:${dish.id}`)]);
    dishesButtons.push([callbackButton(`◀️ Вернуться в меню категорий`, `backInDishCategoryInStockMenu`)]);

    return Markup.inlineKeyboard(dishesButtons).resize();
};

const confirmOrderKB = async (orderId) => Markup.inlineKeyboard([
    [callbackButton(`💸 Сделать компенсацию`, `compensation:${orderId}`)],
    [callbackButton(`✅ Подтвердить выдачу заказа`, `confirmOrder:${orderId}`)],
]).resize();

const backToOrderConfirmKB = (orderId) => Markup.inlineKeyboard([
    [callbackButton(`◀️ Вернуться в меню выдачи заказа`, `backToConfirmOrder:${orderId}`)],
]).resize();

let adminCompensationState = -1;

bot.use(async (ctx, next) => {
    try {
        let msg = ctx.message, data;
        if (!msg && ctx.callbackQuery) {
            msg = ctx.callbackQuery.message;
            data = ctx.callbackQuery.data;
        }
        	
        if (!msg || !msg.chat || msg.chat.type != 'private')
            return;

        let u = await User.findOne({id: msg.chat.id});
        if (!u) {
            u = await User.create({
                id: msg.chat.id,
                total: 0,
            });
        }
        ctx.u = u;
        return next();
    }
    catch (e) {
        console.error(e);
    }
});

bot.on(`text`, async (ctx) => {
    try {
        let uid = ctx.message.chat.id, 
            text = ctx.message.text,
            u = ctx.u;
        
        console.log(`${uid} отправил сообщение: ${text}`);

        if (config.admin == uid) {
            if (text == '/start') {
                adminCompensationState = -1;
                return await ctx.replyWithHTML('Приветствуем! Введите номер заказа, который нужно выдать!', adminMainKB);
            }

            if (adminCompensationState != -1) {
                if (Number.isInteger(Number(text))) {
                    await Order.updateOne({id: adminCompensationState}, {$inc: {compensation: Number(text)}});
                    let order = await Order.findOne({id: adminCompensationState});
                    let sum = 0;
                    let dishes = order.dishIds.map(async dishId => { let dish = await Dish.findOne({id: dishId}); sum += dish.cost; return `🔹 ${dish.name} - ${dish.weight}г - ${dish.cost}р`; });
                    for (let i in dishes)
                        dishes[i] = await dishes[i];
                    adminCompensationState = -1;
                    return await ctx.replyWithHTML(`🍴 <b>Подтверждение заказа №${order.id}</b>

<b>❗️ Если какого-то блюда нет в наличии - сделайте компенсацию!</b>

<b>🛒 Корзина покупателя:</b>
${ order.dishIds.length ? dishes.join('\n') : `<i>В Вашей корзине пусто!</i>`}

<b>💸 Компенсация:</b> <b>${ order.compensation }р</b>

<b>▶️ Итого:</b> <b>${ sum - order.compensation }р</b>`, await confirmOrderKB(order.id));
                } else
                    return await ctx.replyWithHTML(`<b>Введите компенсацию:</b>`, backToOrderConfirmKB(Number(parts[1])));
            }
            

            if (text == '☑️ Наличие блюд') {
                return await ctx.replyWithHTML('Выберите категории блюд для изменения наличия:', chooseDishCategoryInStockKB);
            }

            if (Number.isInteger(Number(text))) {
                let order = await Order.findOne({id: Number(text)});
                if (order && order.state == 'readyToIssue') {
                    let sum = 0;
                    let dishes = order.dishIds.map(async dishId => { let dish = await Dish.findOne({id: dishId}); sum += dish.cost; return `🔹 ${dish.name} - ${dish.weight}г - ${dish.cost}р`; });
                    for (let i in dishes)
                        dishes[i] = await dishes[i];
                    return await ctx.replyWithHTML(`🍴 <b>Подтверждение заказа №${order.id}</b>

<b>❗️ Если какого-то блюда нет в наличии - сделайте компенсацию!</b>

<b>🛒 Корзина покупателя:</b>
${ order.dishIds.length ? dishes.join('\n') : `<i>В Вашей корзине пусто!</i>`}

<b>💸 Компенсация:</b> <b>${ order.compensation }р</b>

<b>▶️ Итого:</b> <b>${ sum - order.compensation }р</b>`, await confirmOrderKB(order.id));
                } else {
                    return await ctx.replyWithHTML('<b>🛑 Заказа с таким номером не найдено!</b>');
                }
            }
            return;
        }

        if (text == '/start') {
            return await ctx.replyWithHTML('Приветствуем!', mainKB);
        }

        if (text == '🍽 Сделать заказ') {
            let order = await Order.create({
                id: (await Order.countDocuments()) + 1,
                userId: u.id,
                state: 'proccess',
                dishIds: [],
                compensation: 0,
            });
            let sum = 0;
            let dishes = order.dishIds.map(async dishId => { let dish = await Dish.findOne({id: dishId}); sum += dish.cost; return `🔹 ${dish.name} - ${dish.weight}г - ${dish.cost}р`; });
            for (let i in dishes)
                dishes[i] = await dishes[i];
            return await ctx.replyWithHTML(`🍴 <b>Оформление заказа №${order.id}</b>

<b>🛒 Корзина:</b>
${ order.dishIds.length ? dishes.join('\n') : `<i>В Вашей корзине пусто!</i>`}

<b>▶️ Итого:</b> <b>${ sum }р</b>`, orderMenuKB(order.id));

        }

        
    }
    catch (e) {
        console.error(e);
    }
});

bot.on('callback_query', async (ctx) => {
    try {
        let uid = ctx.callbackQuery.message.chat.id,
            answer = async (text, keyboard) => ctx.editMessageText(text, { parse_mode, ...keyboard, disable_web_page_preview: true }),
            d = ctx.callbackQuery.data,
            parts = d.split(':'),
            u = ctx.u;

        await u.updateOne({waitFor: ''});
        
        console.log(`${uid} отправил колбэк: ${d}`);

        if (config.admin == uid) {
            if (parts[0] == 'chooseDishCategoryInStock') {
                let dishes = await Dish.find({dishCategory: Number(parts[1])});
                return await answer(`<b>Выберите блюдо, у которого хотите изменить наличие</b>`, chooseDishInStockKB(Number(parts[1]), dishes));
            }

            if (parts[0] == 'changeInStockDish') {
                await Dish.updateOne({id: Number(parts[2])}, {inStock: !(await Dish.findOne({id: Number(parts[2])})).inStock});
                let dishes = await Dish.find({dishCategory: Number(parts[1])});
                return await answer(`<b>Выберите блюдо, у которого хотите изменить наличие</b>`, chooseDishInStockKB(Number(parts[1]), dishes));
            }

            if (parts[0] == 'backInDishCategoryInStockMenu') {
                return await answer('Выберите категории блюд для изменения наличия:', chooseDishCategoryInStockKB);
            }

            if (parts[0] == 'compensation') {
                adminCompensationState = Number(parts[1]);
                return await answer(`<b>Введите компенсацию:</b>`, backToOrderConfirmKB(Number(parts[1])));
            }

            if (parts[0] == 'backToConfirmOrder') {
                adminCompensationState = -1;
                let order = await Order.findOne({id: Number(parts[1])});
                let sum = 0;
                let dishes = order.dishIds.map(async dishId => { let dish = await Dish.findOne({id: dishId}); sum += dish.cost; return `🔹 ${dish.name} - ${dish.weight}г - ${dish.cost}р`; });
                for (let i in dishes)
                    dishes[i] = await dishes[i];
                return await answer(`🍴 <b>Подтверждение заказа №${order.id}</b>

<b>❗️ Если какого-то блюда нет в наличии - сделайте компенсацию!</b>

<b>🛒 Корзина покупателя:</b>
${ order.dishIds.length ? dishes.join('\n') : `<i>В Вашей корзине пусто!</i>`}

<b>💸 Компенсация:</b> <b>${ order.compensation }р</b>

<b>▶️ Итого:</b> <b>${ sum - order.compensation }р</b>`, await confirmOrderKB(order.id));
            }

            if (parts[0] == 'confirmOrder') {
                let order = await Order.findOne({id: Number(parts[1])});
                if (order.state != 'readyToIssue') {
                    await ctx.answerCbQuery(`Сессия устарела!`);
                    return await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
                }
                await order.updateOne({state: 'finished'});
                let sum = 0;
                let costs = await order.dishIds.map(async dishId => { let dish = await Dish.findOne({id: dishId}); return dish.cost;});
                for (let i in costs)
                    sum += await costs[i];
                sum -= order.compensation;
                await User.updateOne({id: order.userId}, {$inc: {total: sum}});
                try { await bot.telegram.sendMessage(order.userId, `<b>🍴 Заказа №${order.id} завершён!</b>`, {parse_mode}); } catch(e) { console.log(e) };
                await ctx.answerCbQuery(`🍴 Заказа №${order.id} завершён!`);
                return await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
            }
        }


        if (parts[0] == 'addDishInOrder') {
            let order = await Order.findOne({id: Number(parts[1])});
            console.log(order.state);
            if (order.state != 'proccess') {
                await ctx.answerCbQuery(`Сессия1 устарела!`);
                return await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
            }
            if (order.dishIds.length >= 10)
                return await ctx.answerCbQuery('В заказ нельзя добавить больше 10 позиций');
            return await answer('<b>Выберите категорию блюда:</b>', chooseDishCategoryKB(order.id));
        }

        if (parts[0] == 'deleteDishInOrder') {
            let order = await Order.findOne({id: Number(parts[1])});
            if (order.state != 'proccess') {
                await ctx.answerCbQuery(`Сессия устарела!`);
                return await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
            }
            if (order.dishIds.length == 0)
                return await ctx.answerCbQuery('В Вашей корзине пусто!');
            return await answer(`<b>Выберите блюдо, которое хотите удалить из корзины:</b>`, await deleteDishKB(order.id));
        }

        if (parts[0] == 'cancelOrder') {
            let order = await Order.findOne({id: Number(parts[1])});
            if (order.state != 'proccess') {
                await ctx.answerCbQuery(`Сессия устарела!`);
                return await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
            }
            await order.updateOne({state: 'canceled'});
            await ctx.answerCbQuery('Заказ успешно отменён!');
            return await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
        }

        if (parts[0] == 'chooseDishCategory') {
            let order = await Order.findOne({id: Number(parts[2])});
            if (order.state != 'proccess') {
                await ctx.answerCbQuery(`Сессия устарела!`);
                return await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
            }
            let dishes = await Dish.find({dishCategory: Number(parts[1]), inStock: true});
            return await answer(`<b>Выберите блюдо, которое хотите добавить в заказ:</b>`, chooseDishKB(order.id, dishes));
        }

        if (parts[0] == 'addDish') {
            let order = await Order.findOne({id: Number(parts[1])});
            if (order.state != 'proccess') {
                await ctx.answerCbQuery(`Сессия устарела!`);
                return await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
            }
            let dishIds = order.dishIds;
            dishIds.push(Number(parts[2]));

            await order.updateOne({dishIds});

            let sum = 0;
            let dishes = order.dishIds.map(async dishId => { let dish = await Dish.findOne({id: dishId}); sum += dish.cost; return `🔹 ${dish.name} - ${dish.weight}г - ${dish.cost}р`; });
            for (let i in dishes)
                dishes[i] = await dishes[i];

            return await answer(`🍴 <b>Оформление заказа №${order.id}</b>

<b>🛒 Корзина:</b>
${ order.dishIds.length ? dishes.join('\n') : `<i>В Вашей корзине пусто!</i>`}

<b>▶️ Итого:</b> <b>${ sum }р</b>`, orderMenuKB(order.id));
        }

        if (parts[0] == 'deleteDish') {
            let order = await Order.findOne({id: Number(parts[1])});
            if (order.state != 'proccess') {
                await ctx.answerCbQuery(`Сессия устарела!`);
                return await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
            }
            let dishIds = order.dishIds;
            dishIds.splice(Number(parts[2]), 1);

            await order.updateOne({dishIds});

            let sum = 0;
            let dishes = order.dishIds.map(async dishId => { let dish = await Dish.findOne({id: dishId}); sum += dish.cost; return `🔹 ${dish.name} - ${dish.weight}г - ${dish.cost}р`; });
            for (let i in dishes)
                dishes[i] = await dishes[i];

            return await answer(`🍴 <b>Оформление заказа №${order.id}</b>

<b>🛒 Корзина:</b>
${ order.dishIds.length ? dishes.join('\n') : `<i>В Вашей корзине пусто!</i>`}

<b>▶️ Итого:</b> <b>${ sum }р</b>`, orderMenuKB(order.id));
        }

        if (parts[0] == 'backInOrderMenu') {
            let order = await Order.findOne({id: Number(parts[1])});
            if (order.state == 'finished') {
                await ctx.answerCbQuery(`Сессия устарела!`);
                return await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
            }
            await order.updateOne({state: 'proccess'});
            let sum = 0;
            let dishes = order.dishIds.map(async dishId => { let dish = await Dish.findOne({id: dishId}); sum += dish.cost; return `🔹 ${dish.name} - ${dish.weight}г - ${dish.cost}р`; });
            for (let i in dishes)
                dishes[i] = await dishes[i];

            return await answer(`🍴 <b>Оформление заказа №${order.id}</b>

<b>🛒 Корзина:</b>
${ order.dishIds.length ? dishes.join('\n') : `<i>В Вашей корзине пусто!</i>`}

<b>▶️ Итого:</b> <b>${ sum }р</b>`, orderMenuKB(order.id));
        }

        if (parts[0] == 'finishOrder') {
            let order = await Order.findOne({id: Number(parts[1])});
            if (order.state != 'proccess') {
                await ctx.answerCbQuery(`Сессия устарела!`);
                return await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
            }
            if (!order.dishIds.length) {
                return ctx.answerCbQuery('В Вашей корзине пусто!');
            }
            await order.updateOne({state: 'readyToIssue'});
            let sum = 0;
            let dishes = order.dishIds.map(async dishId => { let dish = await Dish.findOne({id: dishId}); sum += dish.cost; return `🔹 ${dish.name} - ${dish.weight}г - ${dish.cost}р`; });
            for (let i in dishes)
                dishes[i] = await dishes[i];

            return await answer(`🍴 <b>Выдача заказа №${order.id}</b>

<b>Подоёдите к выдаче и назовите номер своего заказ!</b>

<b>🛒 Корзина:</b>
${ order.dishIds.length ? dishes.join('\n') : `<i>В Вашей корзине пусто!</i>`}

<b>▶️ Итого:</b> <b>${ sum }р</b>`, cancelFinishKB(order.id));
        }

    }
    catch (e) {
        console.error(e);
    }
});

bot.catch(e => console.log(e));

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

console.log('bot started!');
const parse_mode = "html";  
