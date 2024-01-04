$(document).ready(function () {
    $.getJSON("database.json", function (data) {
      
        data.forEach((item) => {
            if (!item.Image || item.Image.trim() === "") {
                item.Image = "https://upload.wikimedia.org/wikipedia/commons/a/ac/No_image_available.svg";
            }
        });

        var columns = setupDataTable(data);

        // Initialize DataTable
        var table = $("#myTable").DataTable({
            data: data,
            columns: columns,
            lengthMenu: [
                [25, 50, 100, 250, -1],
                [25, 50, 100, 250, "All"],
            ],
            pageLength: 25,
            orderCellsTop: true,
            fixedHeader: true,
            initComplete: function () {
                var api = this.api();

                // For each column
                api.columns()
                    .eq(0)
                    .each(function (colIdx) {
                        // Set the header cell to contain the input element
                        var cell = $(".filters th").eq($(api.column(colIdx).header()).index());
                        var title = $(cell).text();
                        $(cell).html('<input type="text" placeholder="' + title + '" />');

                        // On every keypress in this input
                        $("input", $(".filters th").eq($(api.column(colIdx).header()).index()))
                            .off("keyup change")
                            .on("change", function (e) {
                                // Get the search value
                                $(this).attr("title", $(this).val());
                                var regexr = "({search})"; //$(this).parents('th').find('select').val();

                                var cursorPosition = this.selectionStart;
                                // Search the column for that value
                                api.column(colIdx)
                                    .search(this.value != "" ? regexr.replace("{search}", "(((" + this.value + ")))") : "", this.value != "", this.value == "")
                                    .draw();
                            })
                            .on("keyup", function (e) {
                                e.stopPropagation();

                                $(this).trigger("change");
                                $(this).focus()[0].setSelectionRange(cursorPosition, cursorPosition);
                            });
                    });
            },
        });

        // Add a text input to each header cell in the second row for searching
        $("#myTable thead .search-boxes th").each(function (colIdx) {
            var title = $(table.column(colIdx).header()).text();
            $(this).html('<input type="text" placeholder="Search ' + title + '" />');

            $("input", this).on("keyup change", function () {
                if (table.column(colIdx).search() !== this.value) {
                    table.column(colIdx).search(this.value).draw();
                }
            });
        });
    });
});
