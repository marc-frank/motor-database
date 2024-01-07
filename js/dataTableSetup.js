function setupDataTable(data) {
    // Aggregate unique keys from all objects
    var uniqueKeys = new Set();
    data.forEach((item) => {
        Object.keys(item).forEach((key) => {
            uniqueKeys.add(key);
        });
    });

    // Sort keys alphabetically, except for specific keys
    var sortedKeys = Array.from(uniqueKeys).sort();
    var startKeys = ["Image", "Manufacturer", "Name", "Price ($)", "Stator Diameter (mm)", "Stator Height (mm)", "KV (RPM/V)"];
    var endKey = "Link";
    sortedKeys = startKeys.concat(sortedKeys.filter((key) => !startKeys.includes(key) && key !== endKey));
    sortedKeys.push(endKey);

    // Generate dynamic headers and footers
    var headerFooterRow = "";
    sortedKeys.forEach((key) => {
        headerFooterRow += "<th>" + key + "</th>";
    });
    $("#myTable thead tr, #myTable tfoot tr").html(headerFooterRow);

    // Create columns configuration
    var columns = sortedKeys.map((key) => {
        var columnDef = { data: key, defaultContent: "" };
        if (key === "Image") {
            columnDef.render = function (data) {
                return data ? '<img src="' + data + '" alt="Image" width="128" height="128">' : "";
            };
        } else if (key === "Link") {
            columnDef.render = function (data) {
                return data ? '<a href="' + data + '" target="_blank">' + data + "</a>" : "";
            };
        }
        return columnDef;
    });

    return columns;
}
