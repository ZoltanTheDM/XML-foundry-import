class JournalCreator {

	static replaceTag(text, tag, replacement){
		let output = text;
		output = output.replace(new RegExp(`<${tag}>`, "g"), `<${replacement}>`);
		output = output.replace(new RegExp(`</${tag}>`, "g"), `</${replacement}>`);
		return output;
	}

	static async createJournal(journalXML, pack) {

		var text = journalXML.getElementsByTagName("text")[0].innerHTML;

		text = JournalCreator.replaceTag(text, "h", "h1");
		text = JournalCreator.replaceTag(text, "frame", "blockquote");

		var journal = await JournalEntry.create({
		// console.log({
			name: journalXML.getElementsByTagName("name")[0].innerHTML,
			content: text,
		}, { displaySheet: false, temporary: true });

        await pack.importEntity(journal);
        await pack.getIndex(); // Need to refresh the index to update it
        console.log(`Done importing ${journal.name} into ${pack.collection}`);
	}
}

export default JournalCreator;
