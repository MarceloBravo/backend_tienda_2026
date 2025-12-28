const parseData = (req, res, next) => {
    const {
        climate_pledge_friendly,
        has_variations,
        is_amazon_choice,
        is_best_seller,
        is_prime,
        product_minimum_offer_price,
        product_num_offers,
        product_num_ratings,
        product_original_price,
        product_price,
        product_star_rating
    } = req.body;

    if (climate_pledge_friendly) {
        req.body.climate_pledge_friendly = (climate_pledge_friendly === 'true');
    }
    if (has_variations) {
        req.body.has_variations = (has_variations === 'true');
    }
    if (is_amazon_choice) {
        req.body.is_amazon_choice = (is_amazon_choice === 'true');
    }
    if (is_best_seller) {
        req.body.is_best_seller = (is_best_seller === 'true');
    }
    if (is_prime) {
        req.body.is_prime = (is_prime === 'true');
    }

    if (isNaN(product_minimum_offer_price) === false) {
        req.body.product_minimum_offer_price = parseFloat(product_minimum_offer_price);
    }else{
        req.body.product_minimum_offer_price = 0;
    }
    if (isNaN(product_num_offers) === false) {
        req.body.product_num_offers = parseInt(product_num_offers);
    }else{
        req.body.product_num_offers = 0;
    }
    if (product_num_ratings) {
        req.body.product_num_ratings = parseInt(product_num_ratings);
    }
    if (product_original_price) {
        req.body.product_original_price = parseFloat(product_original_price);
    }
    if (product_price) {
        req.body.product_price = parseFloat(product_price);
    }
    if (product_star_rating) {
        req.body.product_star_rating = parseFloat(product_star_rating);
    }
    next();
};
module.exports = parseData;