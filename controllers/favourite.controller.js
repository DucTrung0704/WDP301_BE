const Favourite = require("../models/favourite.model");

exports.addFavorite = async (req, res) => {
    try {
        const { user_id, location, name, address, numberOfFlight } = req.body;
        console.log(location);

        const favorite = await Favourite.create({ user_id, location, name, address, numberOfFlight });
        res.status(201).json(favorite);
    } catch (error) {
        console.log(error.message)
        res.status(500).json({ message: error.message });
    }
}

exports.getFavorite = async (req, res) => {
    try {
        const { user_id } = req.query;
        const favorite = await Favourite.find({ user_id });
        res.status(200).json(favorite);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

exports.getFavoriteById = async (req, res) => {
    try {
        const { id } = req.params;
        const favorite = await Favourite.findById(id);
        if (!favorite) {
            return res.status(404).json({ message: "Không tìm thấy địa điểm yêu thích" });
        }
        res.status(200).json(favorite);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

exports.deleteFavoriteById = async (req, res) => {
    try {
        const { id } = req.params;
        const favorite = await Favourite.findByIdAndDelete(id);
        if (!favorite) {
            return res.status(404).json({ message: "Không tìm thấy địa điểm yêu thích" });
        }
        res.status(200).json({ message: "Xóa địa điểm yêu thích thành công" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

